---
name: hkx-api-connector-builder
description: Build Pi-compatible API connectors, providers, plugins, or MCP integrations by matching the host repo's existing integration architecture.
origin: HKX-converted-for-Pi
---

# HKX API Connector Builder For Pi

Use when adding one more connector/provider/plugin/tool for an external API and the repo already has integration patterns to follow.

## Guardrails

- Do not invent a new connector architecture when the repo has one.
- Do not start from vendor docs alone; inspect existing in-repo connectors first.
- Do not stop at HTTP transport if the repo expects config schema, registry wiring, docs, tests, or permission declarations.
- Do not cargo-cult stale connectors if a newer pattern exists.

## Workflow

### 1. Learn The House Style

Inspect at least two current connectors/providers/tools and map:

- Directory layout and naming.
- Public interface and registration point.
- Config and secret handling.
- Auth, retry, timeout, pagination, and rate-limit conventions.
- Error mapping and logging.
- Test fixtures and validation commands.

### 2. Define The Required Surface

Keep the first connector slice narrow:

- Required auth flow.
- Entities and operations the user actually needs.
- Read/write boundaries.
- Pagination, webhooks, polling, streaming, or batching.
- Failure modes callers must handle.

### 3. Implement Repo-Native Layers

Typical layers:

```text
config/schema
client or transport
mapping layer
connector/provider/tool entrypoint
registry/discovery wiring
tests
docs/examples when expected
```

For Pi MCP/tool integrations, also verify schema names, idempotency, timeout behavior, observation shape, and permission boundaries.

### 4. Validate

- Tests mirror the host repo's existing connector tests.
- Config validation rejects missing or malformed secrets without logging secret values.
- Auth and rate-limit failures produce typed or documented errors.
- Pagination and retries match repo conventions.
- Registration/discovery makes the connector usable through the expected surface.

## Output

```text
Pattern matched:
Connector surface:
Files changed:
Validation:
Residual risk:
```

## Pair With

- `hkx-documentation-lookup` for current vendor API behavior.
- `hkx-error-handling` for failure contracts.
- `hkx-security-review` for auth, secrets, and permissions.
- `hkx-mcp-server-patterns` for MCP tools/resources/prompts.
