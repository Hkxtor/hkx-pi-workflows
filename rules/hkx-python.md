---
description: Python coding, testing, and security guidance.
globs:
  - "**/*.{py,pyi}"
---

# HKX Python Guidance

Use this rule when editing Python.

## Style

- Follow local project style first, then PEP 8.
- Use type annotations on public functions and non-obvious return values.
- Prefer dataclasses, typed dictionaries, or pydantic-style models for structured data when the project already uses them.
- Keep side effects at the boundary; keep core transforms easy to test.

## Errors

- Catch specific exceptions.
- Preserve context when re-raising.
- Do not use bare `except`.
- Do not silently swallow parse, network, filesystem, or database failures.

## Testing

- Use fixtures for filesystem, environment, and external service boundaries.
- Keep tests isolated; restore env and monkeypatches.
- Cover validation failures and edge cases, not only happy paths.

## Security

- Avoid `eval`, unsafe YAML loading, shell interpolation, and path traversal.
- Keep secrets out of logs and snapshots.
- Validate user-controlled paths before reads or writes.
