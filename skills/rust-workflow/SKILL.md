---
name: hkx-rust-workflow
description: "Rust development workflow: safe implementation, tests, and cargo validation. Use for end-to-end Rust change flow. Prefer rust-patterns for crates/FFI/unsafe design and rust-testing for test strategy; not a substitute for those deeper skills."
---

# HKX Rust Workflow

Use when implementing or reviewing Rust changes.

## Read First

- Inspect `Cargo.toml`, workspace layout, feature flags, and existing error types.
- Mirror local patterns for `Result`, error context, tracing, and async runtime.
- Check whether the crate is library, CLI, service, or native binding code.

## Implementation

- Prefer borrowing over ownership when storage or consumption is not required.
- Avoid `unwrap()` and `expect()` in production paths.
- Keep visibility narrow.
- Document unsafe invariants before using `unsafe`.
- Validate external input, paths, and environment-derived values.

## Testing

- Add unit tests for pure behavior and integration tests for public CLI/crate behavior.
- Use isolated temp directories for filesystem tests.
- Cover error paths, not only happy paths.

## Validation

Prefer repo scripts. Common targets:

```bash
cargo fmt --check
cargo check
cargo clippy -- -D warnings
cargo test
```
