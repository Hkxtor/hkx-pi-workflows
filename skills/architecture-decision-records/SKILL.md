---
name: hkx-architecture-decision-records
description: Capture durable Pi project architecture decisions as ADRs with context, alternatives, consequences, lifecycle, and approval-gated writes.
origin: HKX-converted-for-Pi
---

# HKX Architecture Decision Records For Pi

Use when a task makes or investigates a durable technical decision: framework, data model, API style, auth, deployment, package boundary, agent/tool surface, migration strategy, or testing strategy.

## Activation Signals

- User says "record this", "ADR this", or asks why a choice was made.
- A plan chooses between meaningful alternatives.
- A PR or change introduces a new architecture boundary or operational contract.
- A prior decision is superseded or deprecated.

## ADR Shape

```markdown
# ADR-NNNN: <decision title>

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | deprecated | superseded by ADR-NNNN
**Deciders**: <people or team>

## Context
<problem, constraints, and forces>

## Decision
<the choice made>

## Alternatives Considered
### <alternative>
- Pros:
- Cons:
- Why not:

## Consequences
### Positive
### Negative
### Risks and Mitigations
```

## Workflow

1. Detect the decision and confirm it is not trivial formatting or local implementation detail.
2. Check for existing ADRs in the repo's ADR location, commonly `docs/adr/`.
3. Draft the ADR with context, decision, alternatives, consequences, and lifecycle status.
4. Present the draft for user review.
5. Write or update ADR files only after explicit user approval.
6. Update the ADR index if one exists or if the user approved creating one.

## File Conventions

Prefer:

```text
docs/adr/
  README.md
  0001-use-postgres.md
  0002-rest-over-graphql.md
  template.md
```

Respect existing ADR directories, naming, numbering, and templates when present.

## Quality Bar

- Title names the decision, not the task.
- Context is short and concrete.
- Decision is one clear statement.
- Alternatives include real rejected options.
- Consequences state tradeoffs honestly.
- Superseded decisions link to their replacement.

## Pair With

- `hkx-api-design` for API decisions.
- `hkx-database-migrations` for data-shape decisions.
- `hkx-security-review` for auth, secret, permission, or tool-surface decisions.
- `hkx-codebase-onboarding` when reading an unfamiliar decision history.
