---
name: hkx-ai-regression-testing
description: Write regression tests for Pi agent, provider, tool-call, streaming, mock-model, sandbox, and fallback behavior. Use when AI-assisted changes could miss their own blind spots.
origin: HKX-converted-for-Pi
---

# HKX AI Regression Testing For Pi

Use this when changing behavior that an AI agent is likely to misreview with the
same assumptions it used while writing the code.

## High-Risk Pi Areas

- provider conversion in `packages/ai/`
- agent loop behavior in `packages/agent/`
- session, tools, MCP, compaction, auth, or TTSR in `packages/coding-agent/`
- memory and recall in `packages/mnemopi/`
- `python/robomp` automation behavior
- sandbox vs production paths
- streaming vs replay paths
- generated model/provider metadata

## Test the Contract

Every regression test must defend an externally observable contract:

- emitted message shape
- tool-call arguments or results
- retry/fallback transition
- auth error mapping
- rendered/sanitized output
- persisted state
- CLI output or exit behavior
- sandbox and production path parity

Do not add tests that only prove code executed.

## TypeScript Pattern

- Use `bun:test`.
- Prefer real fixtures and mock providers already present in the package.
- Use `spyOn` on imported module namespaces.
- Never use `mock.module()`.
- Restore mocks in `afterEach`.
- Avoid long-lived mutation of `Bun.env`, `process.env`, `process.platform`, or global registries.

Good regression shape:

```typescript
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as provider from "../src/provider";

afterEach(() => {
  // restore spies according to the surrounding file's pattern
});

it("maps auth failure to a credential-disabled event", async () => {
  // trigger real failure path
  // assert public event or returned error shape
});
```

## Python Pattern

- Use `pytest`.
- Prefer `async def test_*` with pytest-asyncio auto mode.
- Match existing `httpx.MockTransport` style in `python/robomp`.
- Keep integration tests gated by `ROBPi_INTEGRATION=1`.

## Rust Pattern

- Put unit tests near the module for narrow logic.
- Use integration tests for public crate behavior.
- Avoid relying on test order or host-specific paths.
- Cover unsafe/native boundaries through observable behavior.

## Verification Commands

Pick the narrowest command first:

```bash
bun --cwd=packages/ai test path/to/file.test.ts
bun --cwd=packages/agent test path/to/file.test.ts
bun --cwd=packages/coding-agent test path/to/file.test.ts
bun run test:rs
bun run test:py
```

Broaden only when the changed contract crosses packages:

```bash
bun run check:ts
bun run test:ts
bun run test
```

## Done

A regression is covered when the test fails on the old behavior, passes on the
fix, and asserts the user/model-visible contract directly.
