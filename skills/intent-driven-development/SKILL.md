---
name: hkx-intent-driven-development
description: Turn ambiguous or high-risk engineering requests into observable acceptance criteria before or during implementation. Use when success is unclear but the feature direction is already chosen. Not product-strategy diagnostics (product-lens), full capability SRS (product-capability), or multi-option decision councils (council).
origin: HKX-converted-for-Pi
---

# HKX Intent-Driven Development For Pi

Use this when a request needs clearer success conditions before code, config, data, or external systems are changed.

## Triggers

- The user asks to clarify a feature, define acceptance criteria, or de-risk a change.
- The change touches auth, security, persistent data, migrations, external APIs, billing, compliance, or destructive operations.
- A PRD, issue, or roadmap item exists but implementation constraints are implicit.
- Multiple reasonable interpretations would produce materially different behavior.

Do not activate for trivial edits, obvious one-line fixes, active debugging with clear failure, or requests whose acceptance criteria are already explicit.

## Operating Rules

1. Inspect available repo context, docs, schemas, tests, and interfaces before asking technical questions.
2. Do not infer business rules, compliance duties, pricing, SLAs, retention, prioritization, or target users from code. Record them as supplied facts or assumptions.
3. Ask only questions that materially affect safety, behavior, compatibility, cost, or scope.
4. Do not block implementation by default. For clear implementation requests, capture compact criteria and continue.
5. Require explicit confirmation only for unresolved decisions that could cause security exposure, data loss, irreversible migration, public contract breakage, external cost, or destructive action.
6. Never copy secrets, production payloads, credentials, tokens, personal data, or private keys into criteria or examples.

## Depth

### Quick Capture

Use for clear, non-trivial, low/moderate-risk work:

- Goal.
- In scope / out of scope.
- Assumptions.
- 3-7 acceptance criteria with verification methods.
- Blocking questions, if any.

### Full Acceptance Brief

Use for ambiguous, cross-system, security-sensitive, data-changing, migration, compliance, or high-cost work:

- Goal and current context.
- Product/business constraints supplied by user or artifact.
- Discovered technical facts from repo evidence.
- Risk review.
- Acceptance criteria.
- Blocking decisions.
- Verification plan and safe environment constraints.

## Acceptance Criteria Shape

Each criterion should include:

- Scenario or starting condition.
- Action or trigger.
- Expected observable behavior.
- Prohibited side effect when meaningful.
- Verification method: automated test, integration check, manual UX review, accessibility check, security review, operational check, or stakeholder acceptance.
- Environment/safety constraint for data, services, cost, secrets, or production-like effects.
- Priority: required, important, or optional.

Avoid vague terms like “correct”, “secure”, “fast”, “robust”, or “intuitive” unless they are tied to observable evidence or explicitly marked as human judgment.

## Output

```text
Goal:
Scope:
Discovered facts:
Assumptions:
Risks:
Acceptance criteria:
Blocking decisions:
Verification plan:
Proceed / wait:
```
