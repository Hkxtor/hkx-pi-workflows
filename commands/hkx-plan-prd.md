---
description: Draft a lean PRD for an Pi implementation and save it under .pi/prds after confirmation.
argument-hint: "[product or feature brief]"
---

# HKX PRD For Pi

Draft a lean PRD for: `$ARGUMENTS`

If the brief is too vague, ask up to three clarifying questions. Otherwise draft the PRD and ask before writing it.

## Output Path

Use:

```text
.pi/prds/{kebab-case-name}.prd.md
```

## PRD Template

```markdown
# PRD: {Feature Name}

## Problem
{What user or operator problem this solves}

## Goals
- ...

## Non-Goals
- ...

## Users And Workflows
- User:
- Workflow:

## Requirements
| ID | Requirement | Priority |
|---|---|---|

## Acceptance Criteria
- [ ] ...

## Delivery Milestones
| Milestone | Scope | Status | Plan |
|---|---|---|---|
| M1 | ... | pending | |

## Risks
| Risk | Mitigation |
|---|---|

## Open Questions
- ...
```

After writing the PRD, recommend running:

```text
/hkx-plan .pi/prds/{kebab-case-name}.prd.md
```
