---
name: hkx-documentation-lookup
description: Resolve current library, framework, SDK, API, CLI, or cloud-service docs via configured docs MCP tools. Use when the answer depends on version-specific external product behavior. Not for general web research, market diligence, or repo-local business logic.
origin: HKX-converted-for-Pi
---

# HKX Documentation Lookup For Pi

Use when the answer depends on current behavior of a library, framework, SDK, API, CLI tool, cloud service, or version-specific migration path.

## When To Use

- Setup, configuration, or migration questions.
- Library-specific code examples.
- API syntax, flags, limits, or lifecycle behavior.
- Debugging a version-specific framework or SDK issue.
- User names a concrete framework or package.

Do not use for general programming concepts or repo-local business logic unless external API behavior is the uncertainty.

## Workflow

1. Extract the library/product name and the exact question.
2. Redact secrets, tokens, hostnames, customer data, and proprietary snippets before sending any query to an external docs tool.
3. Resolve the docs/library ID with the configured Context7-style resolver unless the user supplied an exact `/org/project` ID.
4. Select the best match by exact name, official source, reputation, snippet coverage, version, and relevance to the query.
5. Query documentation with a specific question.
6. Answer from fetched documentation and cite the library/version when it affects the result.

## Limits

- Do not call docs query tools more than necessary; if the answer remains unclear after a few targeted queries, state the uncertainty.
- Prefer official docs over blog posts or generated examples.
- If local repo usage conflicts with external docs, explain the local convention separately.

## Output

```text
Library/docs source:
Version or ID:
Answer:
Example:
Caveats:
```

## Pair With

- `hkx-search-first` before adding dependencies or abstractions.
- `hkx-api-connector-builder` when implementing a new integration after docs lookup.
- `hkx-security-review` when docs involve auth, permissions, secrets, payments, or user data.
