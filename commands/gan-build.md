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
| `--mode=M` | `auto` | desired evaluation mode: `live` (long-running process), `headless` (one-shot invocation), `static`, or `auto` = strongest available |

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

1. **Archive the previous round**, then dispatch the chain **`hkx-gan-pass`** with task = the brief, the iteration number **you** assigned, and — from the second scored round on — the previous weighted score so the evaluator can return `plateau`.

   The chain writes `gan/feedback.md` and `gan/generator-state.md` by `output:`, which
   overwrites them. Move the previous pair into `gan/round-<N>/` first, or the run's
   verdict history is gone and you cannot prove afterwards whether an
   above-threshold round was scored `fail` (correctly continued) or `pass`
   (should have stopped).
2. Read `gan/feedback.md`. Announce the round's **verdict and score** — not the score alone.
3. Act on the verdict:

| Verdict | Action |
| --- | --- |
| `pass` | Stop immediately. A score at or above the threshold with no must-fix is a pass — do not spend another dispatch for polish. |
| `fail` | Next iteration. |
| `no-verdict` | The pass produced no score: timeout, crash, or detached run. Charge the dispatch, **not** a scored round, and retry once with a narrower scope. A second consecutive `no-verdict` stops the run as `blocked`. |
| `plateau` | Stop. Two consecutive scored rounds without score movement is a design/spec problem, not a code problem — escalate instead of burning budget. |
| `blocked` | Stop. The runbook is broken; fix `## How to run it` with the operator before iterating. |

This session is the **single source of the iteration number**. Put it in the dispatch
task and keep it in your own table. A child that prints its own count is reporting a
local counter — reconcile it against yours rather than adopting it, and never let the
two timelines silently diverge.

Track the round table as you go (round, iteration, four criterion scores, weighted,
notes). Keep **dispatch count** and **scored-round count** separate: a timed-out
generator burns the first without moving the second, and a report that conflates them
overstates how much evidence the run actually produced.

### 4. Stop conditions

Stop on any of: pass, plateau, a second consecutive `no-verdict`, iteration cap,
budget cap, or an operator interrupt. Never exceed `--max` dispatches.

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
[GAN] <brief> — <final verdict>
Dispatches: D | Scored rounds: S
| Round | Iter | Verdict | Func | Craft | Coherence | Robustness | Weighted |
No-verdict passes: <dispatch/iter + reason, or none>
Final score: X.X / threshold Y.Y (mode: live|headless|static)
Must-fix remaining: <list or none>
Spec gaps raised: <list or none>
Artifacts: gan/spec.md, gan/generator-state.md, gan/feedback.md, gan/round-*/
Not done / not verified: <explicit list>
```

Three fields are mandatory, not decorative:

- **`Dispatches` vs `Scored rounds`** — a run that spent four dispatches on two scored
  rounds produced two rounds of evidence, and the report must say so.
- **Per-round `Verdict`** — a bare score cannot show whether the loop obeyed its own
  stop rule. `7.75 then 8.35` reads as a healthy climb; `pass at 7.75, continued to
  8.35` is a loop bug, and only the verdict column exposes the difference.
- **`Artifacts` incl. `gan/round-*`** — if the round archive is missing, the history
  was overwritten and the verdicts above cannot be audited.

## Related

- `gan-style-harness` skill — the procedure this command drives (rubric, modes, anti-patterns)
- `chains/hkx-gan-pass.chain.json` — one generator → evaluator pass
- `hkx.gan-generator` / `hkx.gan-evaluator` — the two agents
- `/santa-loop` — adversarial dual review without a build loop
- `loop-design-check` — decidable goal and stop conditions for the loop itself
- `/quality-gate` — deterministic checks after the build lands
