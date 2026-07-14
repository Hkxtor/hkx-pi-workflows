---
name: hkx-mcp-server-patterns
description: "MCP server operations and design for Pi projects: tools, resources, prompts, schemas, stdio/http transports, idempotency, errors, security, and current-doc verification."
origin: HKX-converted-for-Pi
---

# HKX MCP Server Patterns For Pi

Use when building, reviewing, debugging, or operating MCP servers that Pi or
other clients will consume.

## Preflight

MCP SDK APIs change. For implementation details, verify current official docs or
current package docs before copying method names.

Define:

- client target
- transport: stdio or HTTP
- tools/resources/prompts exposed
- auth and secret handling
- idempotency and side effects
- timeout and cancellation behavior
- error shape

## Surface Design

### Tools

- Use narrow, explicit names.
- Validate inputs with schemas.
- Return model-actionable summaries plus structured details when useful.
- Mark side effects clearly.
- Make retries safe or explicitly unsafe.

### Resources

- Treat resource reads as read-only.
- Validate URIs.
- Reject traversal and unsupported schemes.
- Keep large payloads summarized or chunked when possible.

### Prompts

- Keep prompts reusable and parameterized.
- Avoid embedding secrets or environment-specific values.
- Document required arguments.

## Transport

- stdio: local machine integration, simple process lifecycle.
- HTTP: remote or shared server, needs auth, rate limits, health checks, and
  deployment operations.

Keep server logic independent from transport entrypoints when possible.

## Security

- Never expose raw env or credential values.
- Bound filesystem and network access.
- Log developer detail server-side, not in model-visible responses.
- Use allowlists for dangerous resources.
- Treat MCP output as untrusted when it re-enters prompts or tool decisions.

## Operations

Review:

- startup command
- health or smoke check
- timeout handling
- cancellation cleanup
- version pinning
- CI check
- local config examples without secrets

## Output

```text
MCP surface:
Tools/resources/prompts:
Transport:
Security risks:
Operational risks:
Verification:
```
