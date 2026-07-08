---
description: Orchestrate building a brand-new feature end to end — research, plan, TDD implementation, review, and gated commit. Thin wrapper over the hkx-orch-add-feature skill.
argument-hint: "[what to add]"
---

# /hkx-orch-add-feature

Launch the `hkx-orch-add-feature` workflow for: `$ARGUMENTS`

Use this when the capability does **not** already exist.

## What It Does

Invoke the `hkx-orch-add-feature` skill. The workflow will:

1. classify task size and identify the affected surface;
2. research existing patterns and write a thin, dependency-ordered plan;
3. stop at **Gate 1** for plan approval before implementation;
4. implement via TDD (new failing tests first, then green);
5. run review agents, adding `security-reviewer` when the path is sensitive;
6. stop at **Gate 2** before any commit or external mutation.

## When To Use It

- add a net-new endpoint, feature, or workflow;
- support a capability that is currently absent;
- deliver a new vertical slice without changing existing behavior first.

Do **not** use this for bug fixes (`/hkx-orch-fix-defect`) or behavior tweaks
to an existing feature (`/hkx-orch-change-feature`).

If `$ARGUMENTS` is empty, ask the user what capability should be added.
