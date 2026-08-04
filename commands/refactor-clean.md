---
description: Refactor a scoped area while preserving behavior and existing project conventions.
argument-hint: "[scope or goal]"
---

# HKX Refactor Clean For Pi

Refactor scope: `$ARGUMENTS`

If the scope is unclear, ask for clarification before editing.

## Guardrails

- Preserve externally observable behavior.
- Add or update tests only when they protect a contract or regression boundary.
- Avoid broad rewrites and unrelated style churn.
- Prefer existing abstractions over new ones.
- Do not mix refactor with feature changes unless the user asks.

## Workflow

1. Read project guidance and affected files.
2. Identify the behavior contract that must remain true.
3. Run or add a focused test if risk warrants it.
4. Make small, reversible changes.
5. Run targeted validation.
6. Review diff for accidental behavior changes.

## Refactor Targets

Good candidates:

- Duplicate logic with shared behavior
- Long functions with clear internal phases
- Confusing names that hide domain meaning
- Error handling that can be centralized without changing semantics
- Repeated parsing or formatting patterns

Avoid:

- Reformat-only churn
- Moving files without need
- Introducing abstractions for one caller
- Changing public APIs without plan approval

## Final Report

Summarize:

- Behavior preserved
- Files changed
- Validation run
- Any risk that remains
