---
name: hkx-blueprint
description: "Turn a one-line objective into a multi-session construction plan. Each step is cold-start executable with context brief, deps, verification, and exit criteria. Use for multi-PR work. Not for single-PR or just-do-it tasks (use /hkx-plan)."
version: 1.0.0
origin: ECC-converted-for-Pi
---

# Blueprint (Pi)

Turn a one-line objective into a step-by-step construction plan that a **fresh** agent can execute cold.

Operator entry: `/hkx-blueprint`.

## When to Activate

- Multi-PR features, migrations, or refactors spanning sessions
- Parallel workstreams that need a dependency graph
- Context loss between sessions would cause rework

### Do Not Use When

| Instead | Use |
| --- | --- |
| Single-PR / small change | `/hkx-plan` |
| Product requirements only | `/hkx-plan-prd` |
| User says "just do it" | implement directly |
| Plan already exists and needs visual approve | `/hkx-plan-canvas` |

## Pipeline

1. **Research** — git remote/default branch; repo structure; existing `.pi/plans/`, PRDs, ADRs, tests
2. **Design** — 3–12 one-PR-sized steps; dependency edges; parallel vs serial; model tier; rollback
3. **Draft** — write `.pi/plans/{kebab-objective}.blueprint.md` (self-contained steps)
4. **Review** — fresh `hkx.planner` or `hkx.code-reviewer` adversarial pass; fix critical findings
5. **Register** — present step count, parallelism summary, next step; optional `/hkx-plan-canvas`

Git + `gh` available → branch/PR/CI mode per step. Otherwise → direct edit-in-place mode.

## Plan file shape

Write a Markdown file with these sections (use a mermaid flowchart under Graph when useful):

- Title: `# Blueprint: {Objective}`
- **Meta**: mode (`branch-pr` | `direct`), created date, step count, parallel group count
- **Graph**: dependency edges (optional mermaid `flowchart TD`)
- **Invariants**: checks every step must keep green
- **Step N** fields:
  - `id`, `depends_on`, `parallel_with`
  - `model_tier` (`default` | `strong`)
  - `scope`, `forbidden`
  - `context_brief` (cold-start context)
  - `tasks`, `verification`, `exit_criteria`, `rollback`
  - optional `branch`

## Cold-start rule

A step is valid only if an agent with **no prior conversation** can finish it using:

- the step's context brief
- the listed files
- the verification commands

If a step needs "see previous step," fold that knowledge into the brief or split wrong.

## Anti-patterns (review must catch)

- Steps larger than one PR / one session
- Hidden dependencies (shared files claimed parallel)
- Missing verification or vague exit criteria
- Branch mode without rollback
- Requiring secrets or production mutation without approval gates

## Mutation protocol

When the plan changes mid-flight, append an audit note:

```markdown
## Mutations
- {date}: split S3 → S3a/S3b (reason)
- {date}: skipped S5 (reason); dependents updated
```

Never silently reorder without updating `depends_on`.

## Integration

| Surface | Relationship |
| --- | --- |
| `/hkx-plan` | Smaller single-session plans |
| `/hkx-plan-canvas` | Visual annotate/approve of the blueprint file |
| `plan-orchestrate` | Emit agent invocations from a plan |
| `orch-*` | Execute a single operation type end-to-end |
| `santa-method` | Dual-review high-stakes steps after implementation |

## Notes

- Origin: ECC `blueprint` (community), rewritten for `.pi/plans/` and pi-subagents
- Pure guidance skill; no runtime hooks
