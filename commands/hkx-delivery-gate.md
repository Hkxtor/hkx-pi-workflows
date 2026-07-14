---
name: hkx-delivery-gate
description: Run manual delivery quality checks before session completion. Verifies learning capture, build/type/lint/test status, disk space, and rationalization patterns.
---

# /hkx-delivery-gate — Pre-Completion Quality Gate

Run manual delivery checks before finishing a session. Triggers the `hkx-delivery-gate` skill.

## Checks Performed

| Check | Method | Impact |
|---|---|---|
| Learning capture | Glob `.pi/memory/growth-log/` for today's mtime | Warning if stale |
| Build gate | `bun check`, `cargo check`, or equivalent | Must pass |
| Test gate | Targeted test suite | Must pass |
| Lint gate | Format/lint check | Must pass |
| Disk space | `df -h .` | Warn if < 50GB, block if < 15GB |
| Rationalization | Grep for "skip tests", "pre-existing bug", etc. | Warning only |
| Diff review | `git diff --stat` | Advisory |

## Process

1. Run each check using Pi tools.
2. Collect results into a report.
3. Present the report and recommend READY or NOT READY.

## Report Format

```
=== Delivery Gate Report ===

Learning capture:   PASS / WARN / SKIP
Build:              PASS / FAIL / SKIP
Tests:              PASS / FAIL / SKIP
Lint:               PASS / FAIL / SKIP
Disk space:         PASS / WARN / BLOCK  (NN GB free)
Rationalization:    CLEAN / WARN
Diff:               N files changed

Overall:            READY / NOT READY
```

---

*Part of HKX Pi Workflows*
