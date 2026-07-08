---
description: Orchestrate a behavior-preserving refactor — confirm tests are green, restructure in small steps, keep them green, review, and gate commits. Thin wrapper over the hkx-orch-refine-code skill.
argument-hint: "[what to restructure]"
---

# /hkx-orch-refine-code

Launch the `hkx-orch-refine-code` workflow for: `$ARGUMENTS`

Use this when structure should improve but observable behavior must remain the
same.

## What It Does

Invoke the `hkx-orch-refine-code` skill. The workflow will:

1. confirm relevant tests already exist and are green before touching code;
2. add characterization tests first when safety coverage is too thin;
3. stop at **Gate 1** for restructure approval;
4. refactor in small steps, re-running the safety net after each;
5. delegate dead-code and duplication sweeps to `refactor-cleaner` when appropriate;
6. stop at **Gate 2** before commit.

If behavior is meant to change at all, use `/hkx-orch-change-feature` or
`/hkx-orch-fix-defect` instead.

If `$ARGUMENTS` is empty, ask what should be refined.
