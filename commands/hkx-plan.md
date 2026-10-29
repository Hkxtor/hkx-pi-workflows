---
description: Restate requirements, ground in Pi code patterns, create an implementation plan, and wait for confirmation.
argument-hint: "[feature description | path/to/*.prd.md]"
---

# HKX Plan For Pi

Create an implementation plan for: `$ARGUMENTS`

Do not write code during this command. If a plan artifact is needed, use `.pi/plans/`.

## Input Modes

| Input | Mode | Behavior |
|---|---|---|
| Empty | Clarification | Ask what should be planned |
| `path/to/name.prd.md` | PRD artifact | Read PRD, choose the next pending milestone, write `.pi/plans/{name}.plan.md` |
| Any other markdown path | Reference | Read as context and produce an inline plan |
| Free text | Conversational | Produce an inline plan |

## Pattern Grounding

Before planning, search the repo for patterns to mirror:

| Category | Capture |
|---|---|
| Naming | File, function, command, skill, or script naming near the change |
| Errors | How failures are surfaced, logged, retried, or converted |
| Logging | Logger, levels, and message shape |
| Data access | Repository, service, query, or filesystem pattern |
| Tests | Test location, framework, fixtures, and assertion style |

If no matching pattern exists, say so explicitly.

## Step Quality

Each numbered task should state: the specific action and why it exists; the file path or module it touches; dependencies on earlier steps; and a complexity/risk rating (Low/Medium/High). Order tasks by dependency, group related changes, minimize context switching, and keep every step independently verifiable — each step should be testable on its own.

Restate requirements precisely before planning; list assumptions and constraints explicitly (an `Assumptions` section only when needed); identify success criteria up front. Ask clarifying questions when the request is ambiguous. Consider edge cases — null/empty states, failure paths — not only the happy path. Prefer extending existing code over rewriting.

### Sizing and phasing (large features)

When the feature is large, break it into independently deliverable phases, each mergeable on its own:

- **Phase 1** — minimum viable: smallest slice that provides value
- **Phase 2** — core experience: complete happy path
- **Phase 3** — edge cases: error handling, polish
- **Phase 4** — optimization: performance, monitoring

Avoid plans that require all phases to complete before anything works.

### Planning refactors

Identify code smells and technical debt first; list specific improvements; preserve existing functionality; prefer backwards-compatible changes; plan gradual migration when needed.

### Red flags to check before finalizing the plan

- Large functions (>50 lines) or deep nesting (>4 levels) left unaddressed
- Duplicated code, hardcoded values, missing error handling
- Missing tests or no testing strategy
- Steps without concrete file paths
- Phases that cannot be delivered independently

## Plan Shape

Use this format:

````markdown
# Implementation Plan: {Feature}

## Requirements
- ...

## Patterns To Mirror
| Category | Source | Pattern |
|---|---|---|

## Files To Change
| File | Action | Why |
|---|---|---|

## Tasks
1. ...

## Validation
```bash
...
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|

## Acceptance
- [ ] Tasks complete
- [ ] Validation passes
- [ ] Pi patterns mirrored
````

## Confirmation

End with:

`Waiting for confirmation: proceed, modify, or cancel.`
