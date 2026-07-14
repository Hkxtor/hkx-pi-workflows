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
