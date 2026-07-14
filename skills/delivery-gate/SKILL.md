---
name: hkx-delivery-gate
description: "Manual pre-completion delivery hygiene checklist: learning capture, disk space, rationalization signals, and standard build/type/lint/test gates. Use at session end after verification-loop is green. Not a substitute for focused post-change checks (verification-loop) or 5-axis self-scoring (agent-self-evaluation)."
version: 1.0.0
origin: ECC-converted-for-Pi
---

# HKX Delivery Gate — Manual Pre-Completion Checklist

A **manual quality gate** that the operator runs before finishing a session or delivering work. It checks machine-verifiable facts — file modification timestamps, disk usage, and standard build gate output — rather than relying on self-reported status.

This is distinct from reasoning gates (like agent self-evaluation): delivery-gate checks machine-verifiable facts; self-evaluation checks output quality across reasoning dimensions. Together they form defense in depth:

- **delivery-gate**: "Was learning captured? Is disk space safe? Do the standard gates pass?"
- **self-evaluation**: "Is the delivered content correct, complete, and honest?"

This is the same pattern as CI pipeline gates — automated, deterministic checks that verify machine-readable facts.

## When to Activate

- Before declaring a session complete.
- After a complex task (3+ files edited or 50+ lines changed).
- When the user says "we're done" or "ship it."
- When triggered via `/hkx-delivery-gate`.

## What It Checks

| Check | Mechanism | On Hit |
|-------|-----------|--------|
| Learning capture | Check `.pi/memory/growth-log/` or equivalent for today's mtime | Warning if untouched |
| Decision log | Check `.pi/memory/decisions/log.md` for today's mtime | Warning if untouched |
| Rationalization patterns | Search output for "skip tests", "pre-existing bug", "not in scope" | **Warning only** (never blocks) |
| Disk space < 50GB | `df -h .` or similar | Warning |
| Disk space < 15GB | `df -h .` | **Block condition** |
| Build gate | `bun check`, `cargo check`, `go vet`, or equivalent | Must pass |
| Test gate | Targeted test suite for changed code | Must pass |
| Lint gate | Formatter or lint check for changed files | Must pass |
| Diff review | Uncommitted changes reviewed | Advisory |

## Usage

Invoke via command:

```
/hkx-delivery-gate
```

The command runs each check using Pi tools (`bash` for disk / git, `glob` for learning files, `grep` for rationalization patterns) and produces a report.

## Why

Pi's built-in checks cover code quality. But there is a different failure mode: the agent produces working code while session hygiene is neglected — learning not captured, rationalized shortcuts, disk running out silently.

Over many sessions of "ship and forget," the team hasn't grown. This gate enforces the habit: complex task → must verify delivery hygiene.

## Report Template

```text
=== Delivery Gate Report ===

Learning capture:   [PASS / WARN / SKIP]  (growth-log updated today)
Decision log:       [PASS / WARN / SKIP]  (decisions updated today)
Rationalization:    [WARN / CLEAN]         (matched patterns: <none or list>)
Disk space:         [PASS / WARN / BLOCK]  (NN GB free)

Build:              [PASS / FAIL / SKIP]
Tests:              [PASS / FAIL / SKIP]
Lint:               [PASS / FAIL / SKIP]
Diff:               N files changed

Overall:            [READY / NOT READY]
```

## Learning Libraries

Create these files or directories in `.pi/memory/`. The gate checks if at least one was modified today:

```
.pi/memory/
├── growth-log/            # Daily learning entries (directory)
├── decisions/log.md       # Decision log
├── output-index.md        # Index of session outputs
```

## Limitations

The gate checks the **habit** of touching learning libraries, not the **quality** of what was recorded. If `output-index.md` is updated but `growth-log` is skipped, the gate warns but does not block. This is by design: mechanical gates check machine-verifiable facts. For content quality verification, pair with agent self-evaluation.

## Related

- `hkx-agent-self-evaluation` — Reasoning quality assessment (accuracy, completeness, clarity, actionability, conciseness)
- `hkx-quality-gate` — Standard build/type/lint/test gates
- `hkx-gateguard` — Pre-action safety gate for destructive operations
- `hkx-growth-log` — Learning capture methodology
