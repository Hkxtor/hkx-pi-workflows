---
name: hkx-api-design
description: Pi-compatible API design workflow for REST, HTTP, JSON-RPC, internal tool APIs, webhooks, resources, pagination, errors, versioning, and rate limits.
origin: HKX-converted-for-Pi
---

# HKX API Design For Pi

Use this when designing or reviewing an API boundary: HTTP, REST, JSON-RPC, tool
schemas, MCP resources/tools, webhooks, CLI JSON output, or package public APIs.

## Contract First

Define before implementation:

- consumer and owner
- read/write behavior
- auth and permission model
- request schema
- response schema
- error schema
- idempotency and retry rules
- pagination/filter/sort semantics
- compatibility/versioning plan

## Resource Design

- Use nouns for resources.
- Keep verbs for actions that are not CRUD.
- Keep identifiers opaque unless consumers must parse them.
- Avoid leaking internal table or class names into public URLs.
- Use query params for filtering, sorting, search, and pagination.

Typical HTTP shape:

```text
GET    /api/v1/items
GET    /api/v1/items/:id
POST   /api/v1/items
PATCH  /api/v1/items/:id
DELETE /api/v1/items/:id
POST   /api/v1/items/:id/archive
```

## Status and Errors

Use status codes semantically:

| Code | Use |
| --- | --- |
| 200 | successful read/update with body |
| 201 | created; include location when useful |
| 202 | accepted async work |
| 204 | successful no-body response |
| 400 | malformed request |
| 401 | unauthenticated |
| 403 | authenticated but unauthorized |
| 404 | not found or hidden resource |
| 409 | state conflict or duplicate |
| 422 | valid syntax, invalid domain data |
| 429 | rate limited |
| 500 | unexpected server failure |

Error responses should include stable machine-readable codes:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [{ "field": "email", "code": "invalid_format" }]
  }
}
```

## Pagination

- Offset pagination is acceptable for small, internal, or admin datasets.
- Cursor pagination is preferred for large or changing collections.
- Define stable ordering and cursor invalidation behavior.
- Include next links/cursors only when more results exist.

## Webhooks and Writes

- Verify signatures before trusting payload fields.
- Make handlers idempotent.
- Handle duplicate and out-of-order delivery.
- Separate test and production credentials.
- Return quickly; move slow work to a job if the runtime supports it.

## Pi Tool/API Surfaces

For model-callable tools and extensions:

- schema first
- narrow inputs
- deterministic output shape
- explicit side effects
- recovery-oriented errors
- permission boundary before writes or external actions

## Review Output

```text
API contract:
Breaking risks:
Security/permission risks:
Error model:
Pagination/idempotency:
Tests to add:
```
