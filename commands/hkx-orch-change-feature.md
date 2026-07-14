---
description: Orchestrate changing the behavior of an existing, working feature — update tests to the new spec, change the implementation, review, and gate commits. Thin wrapper over the hkx-orch-change-feature skill.
argument-hint: "[new desired behavior]"
---

# /hkx-orch-change-feature

Launch the `hkx-orch-change-feature` workflow for: `$ARGUMENTS`

Use this when an existing feature works, but should now behave differently.

## What It Does

Invoke the `hkx-orch-change-feature` skill. The workflow will:

1. classify scope and keep planning light unless research is genuinely needed;
2. stop at **Gate 1** only when the changed-test plan needs approval;
3. update the existing tests first to express the new desired behavior;
4. change implementation until those tests pass again;
5. run review agents and stop at **Gate 2** before commit.

Do **not** use this for broken behavior (`/hkx-orch-fix-defect`) or net-new
capability (`/hkx-orch-add-feature`).

If `$ARGUMENTS` is empty, ask what behavior should change.
