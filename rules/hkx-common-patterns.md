---
description: Reuse-first, repository, API response, and integration boundary patterns for HKX Pi workflows.
---

# HKX Common Patterns

Use this rule when designing shared code, APIs, persistence boundaries, connectors, or workflow abstractions.

## Reuse First

- Search the repo for existing patterns before creating a new one.
- Prefer extending a current convention over adding a second architecture.
- Add a dependency only when it materially reduces risk or maintenance burden.
- Keep abstractions at the point of repeated need, not at first contact.

## Repository Boundary

Use repository-style boundaries when data access would otherwise leak into business logic:

- Define operations in terms of domain intent, not storage mechanics.
- Keep query builders, ORM models, SDK clients, and file formats behind adapters.
- Return domain/application types from repositories, not raw transport rows unless the surrounding code already does.
- Preserve cancellation, transaction, and error semantics across the boundary.

## API Response Shape

When the project uses response envelopes, keep them consistent:

- Include success/status signal.
- Include data payload or `null` on errors.
- Include machine-readable error codes where callers branch on errors.
- Include pagination metadata for paginated lists.
- Keep user-facing messages separate from logs and internal diagnostics.

If the project does not use envelopes, follow its existing response style instead of introducing one.

## Integration Boundary

For API connectors, tools, MCP servers, or plugins:

- Start from existing in-repo connectors.
- Match config, auth, retry, pagination, error, and registration patterns.
- Keep vendor SDK details inside the connector layer.
- Test observable connector behavior and failure mapping.
