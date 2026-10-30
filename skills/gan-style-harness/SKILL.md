---
name: gan-style-harness
description: Generator-Evaluator adversarial loop that builds a feature or app to a measured quality bar, keeping generation and evaluation in separate context windows. Use when an autonomous build should iterate against a scored rubric, or when self-review keeps passing mediocre output. Not for single-file fixes or already-tested changes.
origin: ECC-converted-for-Pi
---

# HKX GAN-Style Harness

Inspired by Anthropic's harness-design work on long-running application development.

Separate **generation** from **evaluation**. The generator builds; a separate
evaluator, which never sees the generator's reasoning, tests the running artifact and
scores it. The score drives the next iteration.

## Why this survives the single-loop rule

Most subagents should be folded into the main loop — their prompts belong in skills,
their API calls in tools. This harness is a deliberate exception because it hits two
of the three conditions that justify a real subagent boundary:

1. **Fresh, discardable context.** An agent asked to grade its own work is a
   pathological optimist: it praises mediocre output and argues itself out of real
   defects. A separate evaluator that only sees the spec plus the running product is
   far cheaper to make strict than teaching a generator to self-critique honestly.
2. **Conflicting tool surfaces.** The generator writes; the evaluator must not. Giving
   one agent both permissions and asking it to "evaluate, don't fix" is exactly the
   instruction conflict that produces bad self-grades.

Everything else stays in the main loop: the loop itself, the spec, iteration
accounting, and the stop decision.

## Architecture

```text
main loop (holds spec, iteration count, stop decision)
   │
   ├─ 1. write/read gan/spec.md  ← planning folded in, no planner subagent
   │
   ├─ 2. hkx-gan-pass chain
   │     ├─ hkx.gan-generator  (writer)      → gan/generator-state.md
   │     └─ hkx.gan-evaluator  (read-only)   → gan/feedback.md  + verdict inline
   │
   └─ 3. verdict?  pass → stop · fail → next iteration (or stop on plateau)
```

The chain runs **one** pass. The main loop owns repetition — that keeps the plan,
the budget, and the decision in one context, which is the whole point.

## When to Use

- An autonomous build should clear a quality bar, not merely compile.
- Output quality keeps landing at "acceptable for an AI" and nobody catches it.
- Full-stack features where "do the features actually work" is uncertain.
- Cases where a human reviewer would otherwise be the only strict critic.

## When Not To

- Single-file fixes, or a change already locked by passing tests → `tdd-workflow`.
- Well-specified work with a green test suite → `verification-loop`.
- Cheap, low-stakes generation → plain implementation, no harness.
- Pure code review with no build step → `orch-review` or `santa-method`.

## Phase 1 — Spec (main loop, not an agent)

Write `gan/spec.md` yourself. Be deliberately **ambitious**: a conservative spec
produces an underwhelming build, and the evaluator can only grade what the spec
asks for.

```markdown
# Spec — <feature>
## Goal
## Users and jobs
## Must-have features        (numbered, each independently verifiable)
## Nice-to-have features
## Non-goals
## Design direction          (only if there is UI)
## Technical constraints     (stack, runtime, data, deploy target)
## How to run it             (install, dev server command, port, URLs)
## Evaluation criteria       (override the default rubric if this project needs it)
```

`## How to run it` is not optional — an evaluator that cannot start the artifact
cannot evaluate it.

**Write the runbook so a child agent can actually reproduce it.** Two separate
hazards, often confused:

1. **Parseability.** pi's shell gate parses every `bash` command with tree-sitter-bash
   and fails closed on a partial parse, so the whole command becomes an operator
   prompt tagged `<unparsed-bash-subtree>` even when policy would allow it. The real
   trigger is **PowerShell syntax**, which has no bash grammar: `foreach (...) { }`,
   `if (...) { }`, `do { } while (...)`, `function Name { }`, script-block cmdlets
   (`ForEach-Object { }`, `Where-Object { }`), `[Type]::` member access, and `-join`.
   Ordinary bash control flow — `for … do … done`, `while`, `case`, `if [ ]; then`,
   process substitution `<( )` — parses clean and is not a problem.
   When in doubt, check before shipping the spec:

   ```bash
   node scripts/shell-command-preflight.mjs --command "<the command>"
   # exit 0 clean · 2 unresolved · 1 usage/parser-setup error
   ```

2. **Reproducibility.** A step is worthless if the evaluator cannot rerun it
   deterministically. Keep each case one command, or one script invocation, so a
   failure points at a single step:

   - When a case needs a loop, retries, or multi-step setup, commit a small script
     (`scripts/probe-concurrency.sh`) and invoke it once.
   - Prefer an explicit data path (`--data /tmp/gan-probe.json`) over destroying the
     project's real state file between cases.
   - Have the probe print the values the must-have actually asserts on
     (`count 5 uniqueIds 5`), not a shape the evaluator has to interpret.
   - A step that needs a pseudo-TTY cannot be verified this way — put it under
     non-goals or accept it as an explicitly unverified branch.

## Phase 2 — Iterate

Operator entry: **`/gan-build <brief>`** drives the whole loop (spec check, budget gate,
iteration accounting, stop decision). Run this skill directly when driving the loop by hand.

Run one pass:

```text
subagent: hkx-gan-pass
task: <one-paragraph brief>; spec at gan/spec.md; iteration N
```

Then consume the verdict:

| Verdict | Main loop action |
| --- | --- |
| `pass` | Stop. Report final score, scored-round count, known gaps. |
| `fail` | Loop again with the feedback file as input. |
| `no-verdict` | The pass produced no score — timeout, crash, or detached run. Charge the dispatch, not a scored round, and retry once with a narrower scope; a second `no-verdict` stops the run as `blocked`. |
| `plateau` | Stop. Two consecutive scored rounds with no movement is a design problem, not a code problem — escalate to the operator. |
| `blocked` | Stop. The evaluator could not run the artifact; fix the runbook before iterating. |

Record the round table as you go, so the stop decision has evidence. Keep dispatch
count and scored-round count separate — a timeout burns the first without moving the
second:

```text
| Round | Iter | Functionality | Craft | Coherence | Robustness | Weighted | Notes |
```

The main loop is the single source of the iteration number; children that print their
own count are reporting a local counter, not the run's timeline.

## Evaluation Modes

The evaluator has `read`, search, `ls`, and `bash` — no browser tool.

The decisive question is **whether the artifact was really executed**; `live` versus
`headless` is only a sub-shape of "executed". Record the mode you achieved and say how
you achieved it.

| Mode | Meaning | Sub-shape |
| --- | --- | --- |
| `live` | A long-running process was started and driven while it stayed up | Server responding to HTTP or CLI calls, interactive session |
| `headless` | The artifact was invoked once per case and observed | CLI tool, test suite, build, script |
| `static` | Only code and artifacts were read | Last resort, always labeled |

When in doubt between `live` and `headless`, record `headless`: it understates
nothing, whereas `live` overstates. Scoring a code read as `live` or `headless` is a
harness failure, not a result. When only `static` was possible, say so and name what
stays unproven.

## Default Rubric

Score each 1–10, weighted; pass at **7.0** unless the spec overrides it.

| Criterion | Weight | 1–3 | 4–6 | 7–8 | 9–10 |
| --- | --- | --- | --- | --- | --- |
| Functionality | 0.35 | Core paths broken or missing | Happy path only, edge cases fail | All specified features work, errors handled | Holds under adversarial input and empty states |
| Craft | 0.25 | Rough, inconsistent, shortcuts everywhere | Works but unpolished | Consistent structure and naming, no dead code | Everything deliberate, nothing accidental |
| Coherence | 0.20 | Parts do not fit together | Locally fine, globally inconsistent | One consistent whole | Feels designed rather than assembled |
| Robustness | 0.20 | Crashes, silent failures, leaks | Some error handling, gaps remain | Failure paths handled and observable | Failure modes enumerated and proven |

For UI-heavy work, replace `Coherence` with **Design Quality** and add
**Originality** — generic gradients, stock layouts, and template defaults are
penalized, not credited. `make-interfaces-feel-better` is the reference for what
"polished" means there.

## Stop Conditions

Always set all four before the first pass:

1. Weighted score ≥ threshold (`pass`).
2. Iteration cap (5–15 is the useful range; 15 is a hard ceiling).
3. Plateau — three iterations with no score movement.
4. Budget cap — wall-clock or token budget for the whole run.

## Anti-Patterns

1. **Lenient evaluator.** Passing on iteration 1 means the rubric is too generous,
   not that the build is good. Tighten criteria and add explicit penalties.
2. **Generator reading the evaluator's reasoning instead of the findings.** Feedback
   is a findings file; the generator must not see the evaluator's deliberation.
3. **Evaluator writing fixes.** It critiques only. The moment it patches code, it is
   grading its own work and the harness is dead.
4. **Evaluator testing a screenshot.** Interaction is the point — click, submit, hit
   the error path, resize. A static read is a labeled fallback.
5. **Unbounded loop.** No cap means an infinite loop with a cost meter attached.
6. **Inlined feedback.** Pass `gan/feedback.md` as a file, not pasted prose, so the
   generator works from a stable artifact and the diff between iterations is legible.

## Results and Cost

Expect a large multiple in time and cost over a solo pass — commonly an order of
magnitude. The payoff is a build that a strict critic signed off on, not one the
author talked itself into. Use it where the quality bar justifies the multiplier.

## Artifacts

```text
gan/spec.md               main loop, phase 1
gan/generator-state.md    what the generator built and why
gan/feedback.md           evaluator scores, issues, verdict
```

The `/gan-build` command owns this loop end to end; use it unless you are driving the
chain manually.

Add `gan/` to the project's ignore file unless the operator wants the artifacts
committed.

## Related

- `loop-design-check` — whether the loop itself has a decidable goal and sane stop conditions
- `santa-method` — two independent reviewers must both pass (adversarial verification without a build)
- `orch-review` — multi-dimension review of a diff
- `verification-loop` — focused checks after an ordinary change
