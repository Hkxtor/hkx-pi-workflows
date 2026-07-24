---
name: hkx-blueprint
description: "Build a multi-session cold-start construction plan under .pi/plans. Use for multi-PR work, not single-shot /hkx-plan tasks."
argument-hint: "<objective>"
---

# /hkx-blueprint — Multi-session construction plan

Objective: `$ARGUMENTS`

Follow the `blueprint` skill. Do not implement production code in this command.

## Steps

1. If `$ARGUMENTS` is empty, ask for the objective in one sentence.
2. Run the blueprint Research → Design → Draft pipeline.
3. Write:

```text
.pi/plans/{kebab-objective}.blueprint.md
```

1. Adversarial review the plan with a **fresh** subagent (`hkx.planner` or `hkx.code-reviewer`). Fix critical findings in the plan file.
2. Summarize: step count, parallel groups, mode (branch-pr vs direct), first step to run.
3. Offer next actions (do not auto-run unless user asks):

- open visual review: `/hkx-plan-canvas .pi/plans/{file}`
- execute step 1 with the matching `orch-*` or a fresh agent using the step context brief only

## Guardrails

- Prefer 3–12 steps
- Every step must be cold-start executable
- No secrets in the plan file
- Wait for user confirmation before implementing
