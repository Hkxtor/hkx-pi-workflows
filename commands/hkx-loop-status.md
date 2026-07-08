---
description: Inspect the status of a managed OMP loop using local checkpoints, plans, validation evidence, and recent progress signals.
argument-hint: "[optional goal or loop name]"
---

# HKX Loop Status For OMP

Inspect the current loop state for: `$ARGUMENTS`

This command is OMP-native and does **not** rely on Claude transcript scanning
or ECC external CLIs.

## Evidence Sources

Look for status signals in this order:

1. `.omp/checkpoints.log`
2. relevant `.omp/plans/*.md` loop runbooks
3. recent validation evidence the loop claims to depend on
4. current git diff / changed files for signs of stalled progress
5. explicit notes in the current session

If no managed-loop evidence exists, say so plainly instead of guessing.

## What To Report

- active loop objective
- current phase or last successful checkpoint
- open blockers or repeated failure signatures
- drift signals: time, scope, or validation staleness
- intervention recommendation: `continue`, `pause`, `tighten scope`, or `stop`

## Pairing

Use `loop-operator` when the loop needs human intervention.

Use `hkx-session-summary` or `hkx-delivery-gate` when the missing information is
really about session-end evidence rather than loop state.
