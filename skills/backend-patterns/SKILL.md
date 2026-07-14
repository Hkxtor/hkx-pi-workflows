---
name: hkx-backend-patterns
description: Backend design guidance for APIs, services, data access, validation, and operational behavior.
---

# HKX Backend Patterns

Use when implementing or reviewing backend code.

## Boundaries

Validate inputs at:

- HTTP handlers
- CLI argument parsing
- Job payloads
- Webhook handlers
- File and config readers
- MCP or extension interfaces

Use structured parsers when available.

## Services

- Keep handlers thin.
- Put domain behavior in services or local equivalents.
- Keep persistence details behind existing repository/query patterns.
- Make retries explicit and bounded.
- Keep side effects observable and testable.

## Data

- Avoid N+1 queries.
- Add indexes for new query paths when schema changes.
- Use transactions for multi-step state changes.
- Prefer idempotency for webhooks and background jobs.

## Errors And Logging

- Map internal errors to safe external messages.
- Log enough context for diagnosis, not secrets.
- Preserve causality.

## Tests

Cover validation, error mapping, authorization, idempotency, and persistence boundaries.
