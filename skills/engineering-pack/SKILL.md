---
name: hkx-engineering-pack
description: "Router for the HKX Pi engineering pack: research, context retrieval, intent capture, parallel execution, agent-loop design and runaway review, pre-action gating, context hygiene, error handling, API design, connectors, architecture, migrations, production audit, repo scan, onboarding, code tours, ADRs, docs lookup, E2E, accessibility, post-deploy browser QA, and learning capture."
origin: HKX-converted-for-Pi
---

# HKX Engineering Pack For Pi

Use this as the entry point when the task is broad engineering work rather than
one language-specific implementation. Pull in the narrow skill that matches the
work surface.

## Included Skills

| Need | Skill |
| --- | --- |
| Research before implementation | `hkx-search-first` |
| Progressive context retrieval before handoff | `hkx-iterative-retrieval` |
| Acceptance criteria and risk framing | `hkx-intent-driven-development` |
| Parallel work lane planning | `hkx-parallel-execution-optimizer` |
| Goal-oriented agent loop design and runaway review | `hkx-loop-design-check` |
| Fact-forcing before risky actions | `hkx-gateguard` |
| Phase-boundary context hygiene | `hkx-strategic-compact` |
| Failure contracts and error paths | `hkx-error-handling` |
| REST, JSON-RPC, tool, webhook, or public API contracts | `hkx-api-design` |
| New connector/provider/plugin integration | `hkx-api-connector-builder` |
| Ports-and-adapters boundaries and refactors | `hkx-hexagonal-architecture` |
| Schema and data migrations | `hkx-database-migrations` |
| Release readiness and ship risk | `hkx-production-audit` |
| Source inventory and ownership audit | `hkx-repo-scan` |
| Unfamiliar repo onboarding and architecture mapping | `hkx-codebase-onboarding` |
| Reusable code walkthrough artifacts | `hkx-code-tour` |
| Durable architecture decision capture | `hkx-architecture-decision-records` |
| Current external library/framework/API docs | `hkx-documentation-lookup` |
| Browser or workflow E2E tests | `hkx-e2e-testing` |
| Inclusive UI/accessibility review | `hkx-accessibility` |
| Post-deploy visual testing and UI interaction verification | `hkx-browser-qa` |
| Reusable learning-pattern capture from complex tasks | `hkx-growth-log` |

## Selection Rules

- Start with `hkx-search-first` before adding new dependencies, helpers, tools,
  integrations, or abstractions.
- Use `hkx-iterative-retrieval` when broad searches are inconclusive or before delegating unfamiliar repo work.
- Use `hkx-intent-driven-development` when the requested outcome is ambiguous, high-risk, or needs acceptance criteria.
- Use `hkx-parallel-execution-optimizer` when several independent lanes can run concurrently.
- Use `hkx-loop-design-check` when designing or reviewing a repeating agent loop — it covers goal decidability and runaway prevention only; pair with `hkx-parallel-execution-optimizer` / `hkx-agent-introspection-debugging` for mechanism.
- Use `hkx-gateguard` before risky edits, new surfaces, or commands where concrete repository evidence is required.
- Use `hkx-strategic-compact` at safe phase boundaries in long sessions after durable state is summarized.
- Use `hkx-documentation-lookup` when library, framework, SDK, CLI, or API
  behavior must be current.
- Use `hkx-api-design` before committing public or cross-package request/response
  contracts.
- Use `hkx-api-connector-builder` when adding one more integration to an existing
  connector/provider/plugin pattern.
- Use `hkx-hexagonal-architecture` when domain or use-case logic is coupled to
  frameworks, persistence, SDKs, shell, or tool adapters.
- Use `hkx-database-migrations` before any schema, index, backfill, or data shape
  change.
- Use `hkx-production-audit` when the question is "can this ship?"
- Use `hkx-repo-scan` before major refactors, ownership audits, or inherited
  codebase cleanup.
- Use `hkx-codebase-onboarding` when the repo shape and conventions are not yet
  understood.
- Use `hkx-code-tour` when the user wants a reusable walkthrough with verified file and line anchors.
- Use `hkx-architecture-decision-records` when a durable architecture decision is
  made, changed, or investigated.
- Use `hkx-e2e-testing` for user-visible flows and CLI/browser smoke workflows.
- Use `hkx-browser-qa` for post-deploy visual smoke, interaction, regression, and a11y checks against a staging URL via the Pi `browser` tool.
- Use `hkx-growth-log` to extract a transferable learning entry after a complex task, failure, or non-obvious decision.
- Pair with language skills such as `hkx-typescript-workflow`,
  `hkx-python-workflow`, `hkx-rust-workflow`, or `hkx-go-workflow` when editing
  code.

## Pack Output

For broad engineering tasks, report:

```text
Scope: files, packages, or runtime surface.
Skill path: engineering skill(s) used.
Decision: adopt / extend / build / defer.
Verification: commands or checks run.
Residual risk: what was not proven.
```
