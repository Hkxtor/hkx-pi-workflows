---
name: hkx-rust-patterns
description: "Rust design patterns for Pi native crates: ownership, async cancellation, FFI/unsafe, text/search/shell internals, and workspace lints. Use when designing or editing crates/* or native build plumbing. Not general cargo workflow (rust-workflow) or test-authoring focus (rust-testing)."
origin: HKX-converted-for-Pi
---

# HKX Rust Patterns For Pi

Use this for Rust code in `crates/*`, especially `crates/pi-natives` and the
vendored brush crates. Match the workspace's Rust 2024 style and lint policy.

## Ownership

- Borrow slices and `&str` when the function does not retain ownership.
- Prefer `Cow<'_, str>` for conditional normalization.
- Clone only when sharing lifetime or ownership is actually required.
- Make illegal states unrepresentable with enums and small structs.

## Errors

- Use `Result` and `?`; avoid `unwrap()` in production paths.
- Add context at process, IO, parse, FFI, and user-input boundaries.
- Keep library errors precise and caller-actionable.
- Do not collapse distinct failure modes into strings if callers branch on them.

## Async and Cancellation

- Propagate cancellation tokens/signals through long-running operations.
- Avoid blocking inside async tasks unless explicitly isolated.
- Use channels or scoped state instead of global mutable state.
- Bound work for text search, shell, and native operations that can touch large trees.

## Unsafe and FFI

- Keep unsafe blocks small and local.
- Document why each unsafe block is sound.
- Validate buffer lengths, pointer lifetimes, and encoding assumptions at the boundary.
- Convert native errors into stable TypeScript-facing errors.
- Test behavior, not pointer internals.

## Performance

- Measure before changing allocation-heavy or search-heavy paths.
- Avoid allocating per match, per line, or per byte in hot loops.
- Prefer iterators and borrowed data when they keep code readable.
- Keep expensive caches keyed by content, config, or source hash when possible.

## Public API

- Keep `pub` surfaces minimal.
- Do not expose helper types just to make tests easier.
- Put tests in the crate or module that owns the behavior.
- Preserve workspace-level lints unless there is a local, justified allow.

## Pi Build Surface

Native code affects:

- `packages/natives`
- compiled binaries
- install tests
- CI artifact cache keys
- platform-specific `.node` packaging

When changing native interfaces, inspect both Rust and TypeScript call sites.

## Verification

Start narrow:

```bash
bun run test:rs
bun run check:rs
```

For native packaging or ABI changes, also consider:

```bash
bun run build:native
bun run ci:test:smoke
```
