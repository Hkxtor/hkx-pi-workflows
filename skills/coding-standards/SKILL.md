---
name: hkx-coding-standards
description: General maintainable coding standards for Pi-compatible changes (clarity, structure, safe defaults). Use when implementing or reviewing code style beyond language-specific workflows. Not TDD process (tdd-workflow), language toolchains (typescript/python/go/rust-workflow), or security threat review.
---

# HKX Coding Standards

Use when implementing or reviewing code.

## Local Patterns First

Before adding code, inspect nearby examples for:

- Naming
- Module boundaries
- Error handling
- Logging
- Test style
- Configuration shape

Mirror those patterns unless they are clearly broken.

## Design

- Prefer small, explicit changes.
- Add abstractions only when they remove real duplication or simplify a shared concept.
- Keep public APIs stable unless the task requires a change.
- Avoid hidden global state.
- Validate at system boundaries.
- Preserve user-owned config and generated files.

## Errors

- Fail with actionable messages.
- Preserve original causes where useful.
- Do not swallow errors silently.
- Avoid returning ambiguous nulls unless the local API uses that pattern.

## Tests

- Test contracts, not implementation trivia.
- Keep tests deterministic and full-suite safe.
- Avoid long-lived mutations of environment, process state, clocks, or module registries.

## Documentation

Document decisions and non-obvious behavior. Avoid comments that restate the code.
