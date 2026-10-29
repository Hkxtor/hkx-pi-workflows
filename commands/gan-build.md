---
name: gan-build
description: "Autonomous generator-evaluator build loop. The main session writes the spec, then repeats one hkx-gan-pass chain (writer generator + read-only evaluator) until the weighted score clears the bar or a stop condition fires. No auto-commit, no auto-push."
argument-hint: "<build brief> [--max=N] [--threshold=X] [--mode=live|headless|static]"
---

# /gan-build — Build to a scored quality bar

Scope: `$ARGUMENTS`

Follow the `gan-style-harness` skill end-to-end. This command is the operator entry point and the loop owner — the loop, the iteration count, and every stop decision stay in this session by design.

## Goal

The generator implements; an isolated read-only evaluator tests the running artifact and scores it. Iterate until the weighted score clears the threshold, or a stop condition fires. Never let the builder grade its own work.

## Parse

| Token | Default | Meaning |
| --- | --- | --- |
| free text | required | the build brief |
| `--max=N` | `10` | hard iteration cap (ceiling 15) |
| `--threshold=X` | `7.0` | weighted pass score, 1–10 |
| `--mode=M` | `auto` | desired evaluation mode: `live`, `headless`, `static`, or `auto` = strongest available |

Empty brief → ask what to build before anything else.

## Workflow

### 1. Establish the spec (main session, no planner agent)

If `gan/spec.md` exists, read it and summarize it back in one paragraph.

If it does not, write it now following the skill's Phase 1 template — goal, users and jobs, numbered must-haves, non-goals, design direction (if there is UI), technical constraints, **how to run it**, and evaluation criteria. Be ambitious: a timid spec caps the ceiling, and the evaluator can only grade what the spec asks for.

`## How to run it` is mandatory — install command, dev server command, port, URLs. An evaluator that cannot start the artifact cannot evaluate it, and will return `blocked`.

### 2. Budget gate

State the run parameters before the first dispatch, and get confirmation when the run is expensive:

```text
[GAN] <one-line brief>
Spec: gan/spec.md
Max iterations: N | Pass threshold: X | Evaluation mode: auto
Expected: N × (generator + evaluator) child runs; expect a large cost multiple over a single pass.
```

Proceed automatically for short, low-stakes runs. Ask before starting when `--max` is above 5, or when the brief implies a full application.

### 3. Iterate

For each iteration `N` (starting at 1):

1. Dispatch the chain **`hkx-gan-pass`** with task = the brief, the iteration number, and — from iteration 2 on — the previous weighted score so the evaluator can return `plateau`.
2. Read `gan/feedback.md`. Announce the score table and the verdict in one compact block.
3. Act on the verdict:

| Verdict | Action |
| --- | --- |
| `pass` | Stop. Go to step 5. |
| `fail` | Next iteration. |
| `plateau` | Stop. Three iterations without score movement is a design/spec problem, not a code problem — escalate instead of burning budget. |
| `blocked` | Stop. The runbook is broken; fix `## How to run it` with the operator before iterating. |

Track the iteration table as you go (iteration, four criterion scores, weighted, notes). The stop decision must rest on that evidence, not on a feeling.

### 4. Stop conditions

Stop on any of: pass, plateau, iteration cap, runabout budget, or an operator interrupt. Never exceed `--max`.

### 5. Verify and report

Run the repo's own narrow validation before claiming the build is deliverable. Do not commit, push, tag, or open a PR — the loop produces a build, the operator ships it.

## Guardrails

- **Do not self-evaluate.** The main session may sanity-check that the build runs; it may not produce rubric scores. That is the evaluator's job and duplicating it corrupts the loop.
- **Do not edit the rubric or spec mid-run** to make the work pass. If the spec is wrong, stop and renegotiate it with the operator.
- **Do not weaken or delete tests** to turn a check green.
- **Report the achieved evaluation mode honestly.** A `static` pass reported as `live` is a harness failure. When `live` is unavailable, say which mode ran and what that leaves unproven.
- **No network installs or dependency changes** without approval.
- **One writer.** Only the generator writes source during the loop; this session must not edit the build in parallel.
- If pi-subagents is unavailable, say so and stop — do not simulate the loop with a single agent self-scoring.
- Add `gan/` to the project's ignore file unless the operator wants the artifacts committed.

## Complete

Return:

```text
[GAN] <brief> — <verdict> at iteration N
| Iter | Func | Craft | Coherence | Robustness | Weighted |
Final score: X.X / threshold Y.Y (mode: live|headless|static)
Must-fix remaining: <list or none>
Spec gaps raised: <list or none>
Artifacts: gan/spec.md, gan/generator-state.md, gan/feedback.md
Not done / not verified: <explicit list>
```

## Related

- `gan-style-harness` skill — the procedure this command drives (rubric, modes, anti-patterns)
- `chains/hkx-gan-pass.chain.json` — one generator → evaluator pass
- `hkx.gan-generator` / `hkx.gan-evaluator` — the two agents
- `/santa-loop` — adversarial dual review without a build loop
- `loop-design-check` — decidable goal and stop conditions for the loop itself
- `/quality-gate` — deterministic checks after the build lands
