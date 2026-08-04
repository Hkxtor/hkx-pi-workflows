---
description: Identify meaningful coverage gaps and add tests that protect observable behavior.
argument-hint: "[scope]"
---

# HKX Test Coverage For Pi

Improve test coverage for: `$ARGUMENTS`

## Principles

- Test user-visible behavior, public contracts, state transitions, parsing boundaries, and error mapping.
- Do not add placeholder tests or assertions that only prove code executed.
- Avoid duplicating coverage already proven at a higher level.
- Keep tests full-suite safe: no leaked globals, env mutation, or persistent filesystem state.

## Workflow

1. Detect the test framework and existing conventions.
2. Identify uncovered or under-protected contracts.
3. Add the smallest meaningful test set.
4. Run the new tests and confirm they fail if the behavior is missing.
5. Implement or adjust code only if needed.
6. Run targeted tests, then broader tests if shared behavior changed.

## Output

Report:

- Contracts covered
- Test files added or changed
- Commands run
- Remaining gaps and why they were not covered now
