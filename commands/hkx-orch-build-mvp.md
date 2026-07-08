---
description: Orchestrate bootstrapping a working MVP from a design or spec document — slice the spec, scaffold the first slice, TDD the rest, review, and gate commits. Thin wrapper over the hkx-orch-build-mvp skill.
argument-hint: "[path/to/spec.md]"
---

# /hkx-orch-build-mvp

Launch the `hkx-orch-build-mvp` workflow for: `$ARGUMENTS`

Use this when a design or PRD exists and the goal is to turn it into a working
first slice rather than debate the architecture indefinitely.

## What It Does

Invoke the `hkx-orch-build-mvp` skill. The workflow will:

1. read the spec and extract scope, locked decisions, and slice boundaries;
2. convert the work into **thin vertical slices** instead of layer-by-layer scaffolding;
3. stop at **Gate 1** for slice-plan approval;
4. scaffold the first end-to-end slice, then TDD each remaining slice;
5. review each slice and stop at **Gate 2** before commit.

Prefer spec paths under `.omp/prds/` when that is the repo's documented PRD
location.

If `$ARGUMENTS` is empty, ask the user for the design or spec path.
