---
description: Code review triggers, checklist, severity, and approval criteria for HKX Pi workflows.
---

# HKX Common Code Review

Read this rule after writing or modifying code, before committing shared work, and when reviewing PRs or local changes.

## Review Triggers

Review is required when a change touches:

- Runtime behavior, public APIs, persistence, auth, billing, user data, file IO, network calls, or shell/tool execution.
- Agent prompts, commands, skills, rules, MCP config, extension packages, or permission surfaces.
- Architecture boundaries, data models, migrations, deployment, or release behavior.

## Pre-Review Requirements

Before marking work complete:

- Run the smallest meaningful validation that exercises the changed behavior.
- Resolve merge conflicts and generated-artifact drift.
- Update directly affected callsites, tests, and docs.
- Confirm no hardcoded secrets, debug logs, placeholders, or stale compatibility aliases were introduced.

## Severity

| Level | Meaning | Action |
|---|---|---|
| P0 | Security vulnerability, data loss, destructive operation, or production outage risk | Block until fixed |
| P1 | Correctness bug, broken contract, missing validation, or high-impact regression | Fix before merge unless explicitly accepted |
| P2 | Maintainability, test gap, performance, or observability issue with clear future cost | Fix when practical or record residual risk |
| P3 | Style, naming, or local cleanup suggestion | Optional |

## Checklist

- Code solves the requested problem without shrinking scope.
- Names and boundaries match existing project patterns.
- Error handling is explicit and preserves useful context.
- Inputs at trust boundaries are validated.
- Tests cover behavior, edge cases, and failure paths introduced by the change.
- Performance costs are bounded for hot paths, loops, streaming, and large inputs.
- New dependencies, external calls, and permissions are justified.
- Security-sensitive changes receive a dedicated security review.

## Output

Review findings should be ordered by severity and include:

```text
P0/P1/P2/P3 - Title
File: path:line
Issue:
Impact:
Suggested fix:
Confidence:
```

If no findings are found, state that clearly and include any validation or coverage gaps that remain.
