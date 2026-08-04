---
description: Orchestrate a read-only Pi pull request or local diff review with available reviewer agents.
argument-hint: "[pr-number | pr-url | branch | blank for local diff]"
---

# HKX PR Review For Pi

Review target: `$ARGUMENTS`

Default to read-only. Do not post comments, approve, request changes, merge, push, or mutate external systems unless the user explicitly asks.

## Resolve Target

| Input | Review target |
|---|---|
| Empty | Current local diff |
| PR number or URL | That pull request |
| Branch name | Matching branch or PR when discoverable |

Use the evidence available in this Pi session. Prefer `read`, `search`, and `find` for repository context. Use `bash` only for read-only evidence commands when needed, such as inspecting a local diff or available PR metadata. If no GitHub/PR tooling is available, review the local branch evidence and state the limitation.

## Gather Evidence

Collect enough evidence before launching reviewers:

- PR metadata: title, description, linked issue, author intent, changed files, review comments, and stated test plan when available.
- Local evidence: changed file list, diff/stat, relevant nearby code, tests touched or omitted, and project guidance.
- Risk context: security boundaries, type/API contracts, persistence/migrations, concurrency, error handling, and user-visible behavior.
- Verification context: test commands claimed by the PR, CI status if visible, and any locally observed failures.

Read changed files or focused ranges with `read`; locate related callers, tests, schemas, and configs with `search`/`find`; use `bash` for read-only commands only when the repository surface requires it.

## Orchestrate Reviewers

Use `task` to run only the reviewer agents that are available in the current Pi environment:

- `code-reviewer` for correctness, regressions, maintainability, and user-facing behavior.
- `security-reviewer` for trust boundaries, secrets, injection, authz/authn, unsafe commands, and data exposure.
- `pr-test-analyzer` for test coverage, missing edge cases, flaky or misleading tests, and CI evidence.
- `silent-failure-hunter` for swallowed errors, false success states, ignored promises/results, and degraded observability.

Do not invent unavailable agents. If an agent is missing, cover that perspective in the final synthesis only when the evidence supports it.

## Synthesize Findings

Deduplicate overlapping agent findings and report only actionable issues with concrete evidence.

Order by severity:

- `P0`: exploitable security issue, data loss, destructive behavior, or release-blocking breakage.
- `P1`: likely production bug, missing validation at a boundary, serious test gap, or broken contract.
- `P2`: maintainability, type-design, or test-quality issue likely to cause future defects.
- `P3`: minor cleanup only when it materially improves the PR.

Finding format:

```text
P0/P1/P2/P3 - Title
File: path:line
Evidence:
Impact:
Suggested fix:
Confidence:
```

Then include:

- Review target and evidence sources used.
- Reviewers run and reviewers unavailable.
- Validation observed or not observed.
- Open questions or assumptions.

If no findings are found, say so clearly and name the residual risks or unobserved validation.