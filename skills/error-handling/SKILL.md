---
name: hkx-error-handling
description: Robust Pi error handling across TypeScript, Rust, Python, providers, tools, MCP, streaming, auth, retries, and TUI rendering. Use when designing failures or debugging swallowed errors.
origin: HKX-converted-for-Pi
---

# HKX Error Handling For Pi

Use this when adding or changing failure behavior. Pi errors are part of the
agent contract: the user, model, renderer, retry loop, and tests may all depend
on the exact shape.

This skill is part of the Engineering Pack. Pair it with `hkx-api-design` for
API errors, `hkx-database-migrations` for migration recovery, and
`hkx-e2e-testing` when the failure must be proven through a user-visible flow.

## Principles

- Fail at the boundary that has the best context.
- Preserve developer detail in logs, not user-facing text.
- Return model-actionable errors from tools.
- Never silently swallow errors.
- Do not retry errors that are deterministic or unsafe.
- Keep cancellation distinct from failure.
- Sanitize error text before TUI display.

## TypeScript

Use existing project error types and helpers before adding new ones. When adding
an error type, make the public contract explicit:

```typescript
class ProviderAuthError extends Error {
  constructor(readonly provider: string, message: string) {
    super(message);
    this.name = "ProviderAuthError";
  }
}
```

Catch blocks must do one of:

- handle completely
- map to a stable public error
- log with structured context and rethrow
- convert to a tool result with a safe next action

Do not `console.log`, `console.warn`, or `console.error` in
`packages/coding-agent`. Use `logger` from `@oh-my-pi/pi-utils`.

## Tool Errors

Tool failures should answer:

- what failed
- whether anything changed
- whether retry is safe
- what input/path/permission is needed next

Avoid raw stack traces in model-visible output unless the user explicitly asked
for debugging internals.

## Streaming and Retry

- A stream abort is not always a provider failure.
- Retry loops must preserve original intent and stop conditions.
- Rate limits need bounded backoff and visible retry state.
- Auth failures should disable or refresh credentials through the owned auth path.
- Compaction retry must not dump raw provider bodies into the UI.

## Rust

- Prefer `Result<T, E>` and `?`.
- Add context at IO, parse, native, and FFI boundaries.
- Avoid `unwrap()` outside tests and compile-time invariants.
- Keep panic paths out of model/user-triggered operations.
- Map native errors into stable TypeScript-facing messages.

## Python

- Raise typed/domain errors inside `python/robomp` where callers branch on cause.
- Keep HTTP client errors distinct from worker/task errors.
- Use pytest to assert surfaced behavior, not implementation internals.

## Rendering

Before error text reaches TUI:

- replace tabs
- truncate long lines
- shorten paths where appropriate
- redact secrets
- avoid embedding full file contents in an exception message

## Verification

Add focused tests for:

- error mapping
- retryability decision
- cancellation path
- auth fallback/disable behavior
- sanitized rendered output
- no partial mutation after failure
