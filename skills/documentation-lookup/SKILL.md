---
name: documentation-lookup
description: Resolve current library, framework, SDK, API, CLI, or cloud-service docs via configured docs MCP tools or web search. Use when the answer depends on version-specific external product behavior. Not for general web research, market diligence, or repo-local business logic.
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

1. Extract the library/product name and the exact question. When the question is ambiguous, ask for the library name or clarify the topic before any lookup.
2. Redact secrets, tokens, hostnames, customer data, and proprietary snippets before sending any query to an external docs tool or web search.
3. Resolve the best source: a configured Context7-style docs resolver (unless the user supplied an exact `/org/project` ID), the official docs site via `web_search` when no docs MCP tool is configured, or vendored docs in the repo. When the user specified a version, prefer version-matched docs.
4. Fetch and read only what is needed to answer the specific question.
5. Answer from fetched documentation and cite the library/version when it affects the result. Prefer a fetched source over recall — never make up API details or versions — and state clearly when you are inferring from the docs versus quoting an explicit behavior.

## Lookup budget

- Cap resolve-and-fetch cycles at **3** per request.
- If results are still insufficient after 3 cycles, answer with the best information available and say so explicitly; mark the answer as best-effort and note that details may be outdated.

## Limits

- Do not call docs query tools more than the budget above; state uncertainty instead of iterating further.
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

- `search-first` before adding dependencies or abstractions.
- `api-connector-builder` when implementing a new integration after docs lookup.
- `security-review` when docs involve auth, permissions, secrets, payments, or user data.
