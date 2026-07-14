---
description: Go coding, testing, and security guidance.
globs:
  - "**/*.go"
  - "**/go.mod"
---

# HKX Go Guidance

Use this rule when editing Go.

## Style

- Let `gofmt` and `goimports` decide formatting.
- Keep interfaces small and consumer-owned.
- Accept interfaces and return concrete structs when that matches local design.
- Keep package APIs narrow and names idiomatic.

## Errors

- Check errors immediately.
- Wrap errors with useful context using `%w`.
- Avoid panics in library or request-handling code.
- Keep sentinel errors and typed errors consistent with the surrounding package.

## Testing

- Use table-driven tests for input/output matrices.
- Cover error paths and boundary values.
- Avoid sleeps in tests; use controllable clocks or synchronization.

## Security

- Validate request inputs and file paths.
- Use context cancellation for external calls.
- Avoid shell interpolation and unbounded goroutines.
