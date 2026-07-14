---
name: hkx-python-workflow
description: Python development workflow for testing, typing, security hygiene, and maintainability on Pi projects. Use when editing Python code. Not generic coding-standards-only asks or other language workflows.
---

# HKX Python Workflow

Use when implementing or reviewing Python changes.

## Read First

- Inspect `pyproject.toml`, test config, linters, and existing package layout.
- Identify whether the project uses dataclasses, pydantic, attrs, TypedDict, or plain dictionaries.
- Mirror local async, logging, and error-handling patterns.

## Implementation

- Add type annotations for public and non-obvious functions.
- Keep business logic separate from filesystem, network, and process boundaries.
- Catch specific exceptions and preserve context.
- Avoid unsafe YAML loading, `eval`, shell interpolation, and unchecked user paths.

## Testing

- Use fixtures for temp files, env, and service boundaries.
- Cover error paths and validation failures.
- Keep monkeypatches scoped to the test.

## Validation

Prefer project scripts. Common targets:

```bash
python -m pytest path/to/test.py
ruff check .
ruff format --check .
pyright .
python -m compileall -q .
```
