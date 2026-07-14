---
description: Rust coding, testing, and security guidance.
globs:
  - "**/*.rs"
  - "**/Cargo.toml"
---

# HKX Rust Guidance

Use this rule when editing Rust.

## Style

- Let `rustfmt` settle formatting.
- Prefer immutable bindings; use `mut` only when mutation clarifies the code.
- Borrow by default. Take ownership only when storing or consuming a value.
- Accept `&str` over `String` and `&[T]` over `Vec<T>` when ownership is not needed.
- Default to private visibility; expose only the intended API.

## Errors

- Return `Result` and use `?`.
- Avoid `unwrap()` and `expect()` in production paths.
- Add context to I/O, parse, and external-boundary errors.
- Use typed errors for libraries and flexible context for applications if that is the local pattern.

## Testing

- Test boundary behavior and error cases.
- Keep temp files isolated.
- Use integration tests for public CLI or crate behavior.

## Security

- Avoid unsafe code unless the invariant is documented and reviewed.
- Validate paths and external input.
- Avoid panics in request, CLI, or long-running service paths.
