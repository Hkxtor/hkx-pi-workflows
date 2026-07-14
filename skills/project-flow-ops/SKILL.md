---
name: hkx-project-flow-ops
description: "Project-flow operations for Pi repos: classify issues and PRs into merge, fix, rebuild, close, or park; coordinate public GitHub state with internal execution notes."
origin: HKX-converted-for-Pi
---

# HKX Project Flow Ops For Pi

Use when the problem is backlog and execution coordination, not direct coding.

## Inputs

- open issues
- open PRs
- CI status
- review status
- linked work items or local planning docs
- release milestones

## Classification

Every item should land in one state:

| State | Meaning |
| --- | --- |
| Merge | self-contained, reviewed, green, policy-compliant |
| Fix | valuable and close, but blocked by concrete issues |
| Rebuild | useful idea, but should be re-landed manually |
| Close | duplicate, stale, unsafe, wrong direction |
| Park | valid but not scheduled now |

## Workflow

1. Read public state first: title, body, comments, diff if PR, checks.
2. Identify owner and blocker.
3. Classify into one state.
4. Draft public next action.
5. Decide whether internal tracking is warranted.

Only create/update external trackers when the user explicitly approves. If the
tracker is unavailable, return a local tracking note.

## Review Rules

- CI red blocks merge classification unless explicitly accepted.
- Community contributions need tests or a clear reason tests are not needed.
- Large external PRs can be valuable but still require rebuild classification.
- Product-direction blockers should be named directly.
- Do not mirror every GitHub issue into internal tracking.

## Output

```text
PUBLIC STATUS
- issue/PR:
- CI/review:

CLASSIFICATION
- merge / fix / rebuild / close / park:
- rationale:

TRACKING ACTION
- none / draft / update with approval:

NEXT OPERATOR ACTION
- exact next move:
```
