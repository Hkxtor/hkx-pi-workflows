---
name: hkx-rust-testing
description: Rust testing patterns for Pi crates, native bindings, async cancellation, and platform-sensitive builds. Use when adding or fixing Rust tests/regressions. Not general implementation workflow (rust-workflow) or non-test design patterns (rust-patterns).
origin: HKX-converted-for-Pi
---

# HKX Rust Testing For Pi

Use this when Rust behavior changes in `crates/*` or when TypeScript/native
integration depends on Rust output.

## Test Scope

Choose the narrowest useful level:

| Change | Test |
| --- | --- |
| pure function or parser | module unit test |
| public crate behavior | integration test |
| native binding contract | TypeScript test in `packages/natives` plus Rust test if needed |
| platform packaging | native build or install smoke |
| cancellation/performance | bounded regression test or benchmark-style fixture |

## Contracts Worth Testing

- exact parse result or normalized output
- error kind and user-facing message
- cancellation leaves no stuck task
- content or path search ordering when callers depend on it
- Unicode width, path, or shell escaping behavior
- native ABI returns stable structures to TypeScript
- vendored brush behavior remains compatible with Pi expectations

## Test Style

- Avoid time-sensitive sleeps when a deterministic signal exists.
- Use temp directories with explicit cleanup or test-owned paths.
- Keep host assumptions visible: OS, shell, path separators, executable availability.
- Do not test private helper wiring if public behavior already proves it.
- Avoid broad fixtures that make failures hard to localize.

## Running Tests

Use repo scripts first:

```bash
bun run test:rs
bun run check:rs
bun run lint:rs
```

For TS/native integration:

```bash
bun --cwd=packages/natives test path/to/file.test.ts
bun run build:native
```

For release-sensitive native changes:

```bash
bun run ci:test:smoke
bun run ci:test:install-methods
```

## Regression Rule

For a bug fix, add the smallest test that would have failed before the fix. The
assertion should name the external behavior, not the implementation detail.
