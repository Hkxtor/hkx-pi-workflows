---
description: Orchestrate fixing a bug — reproduce it as a failing regression test, fix to green, review, and gate commits. Thin wrapper over the hkx-orch-fix-defect skill.
argument-hint: "[what is broken]"
---

# /hkx-orch-fix-defect

Launch the `hkx-orch-fix-defect` workflow for: `$ARGUMENTS`

Use this when current behavior is broken, wrong, or regressed.

## What It Does

Invoke the `hkx-orch-fix-defect` skill. The workflow will:

1. scope the defect and use `code-explorer` if root cause is unclear;
2. write a **new failing regression test** that proves the defect exists;
3. fix the implementation until the regression goes green;
4. route build/type failures to `build-error-resolver` or `/hkx-build-fix` if needed;
5. run review agents and stop at **Gate 2** before commit.

Use this only for broken behavior. If the feature works but should change, use
`/hkx-orch-change-feature`.

If `$ARGUMENTS` is empty, ask the user to describe the defect.
