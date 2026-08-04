---
description: Review local changes or a GitHub PR, prioritizing bugs, regressions, security, and missing tests.
argument-hint: "[pr-number | pr-url | blank for local diff]"
---

# HKX Code Review For Pi

Review target: `$ARGUMENTS`

Default to read-only review. Do not post, approve, request changes, or comment on external systems unless the user explicitly asks.

## Mode Selection

| Input | Mode |
|---|---|
| Empty | Local uncommitted diff |
| PR number or URL | Pull request review |
| Branch name | Find matching PR if GitHub tooling is available |

## Gather

Local mode:

```bash
git diff --name-only HEAD
git diff --stat HEAD
```

PR mode:

- Fetch PR metadata and changed file list with available GitHub tooling.
- Read PR intent, linked issues, and test plan.
- Read changed files in full where needed, not only hunks.

Always read relevant `AGENTS.md`, `.pi/`, `.codex/`, or other project guidance.

## Review Checklist

Prioritize:

- Correctness bugs and regressions
- Security vulnerabilities
- Data loss or destructive behavior
- Missing validation at trust boundaries
- Missing tests for changed contracts
- Performance problems with real user impact
- Pattern violations likely to break maintainability

## Output Format

Findings first, ordered by severity:

```text
P0/P1/P2/P3 - Title
File: path:line
Issue:
Impact:
Suggested fix:
Confidence:
```

Then include:

- Open questions or assumptions
- Validation reviewed
- Brief summary

If no issues are found, say so clearly and note any residual test gaps.
