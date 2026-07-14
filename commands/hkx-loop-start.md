---
description: Design and stage a managed autonomous loop with Pi-native safety defaults, checkpoints, and explicit stop conditions.
argument-hint: "[goal] [--pattern sequential|watchdog|review|continuous] [--mode safe|fast]"
---

# HKX Loop Start For Pi

Design and stage a managed loop for: `$ARGUMENTS`

If the goal is missing, ask the user what the loop is supposed to accomplish.

## Patterns

| Pattern | Use When |
|---|---|
| `sequential` | One bounded phase follows another |
| `watchdog` | A repeating check monitors drift or staleness |
| `review` | Repeated inspect → verify → decide cycles |
| `continuous` | Long-running maintenance with explicit checkpoints |

## Modes

| Mode | Behavior |
|---|---|
| `safe` | Strong checkpoints, narrower scope, explicit approval gates |
| `fast` | Lighter checkpoints for low-risk maintenance loops |

## Required Safety Checks

Before proposing or launching the loop:

- make the goal machine-decidable;
- define an explicit stop condition;
- define rollback or pause behavior;
- identify what the loop may **not** mutate without approval;
- confirm what evidence will be written to `.pi/checkpoints.log` or a plan artifact.

## Workflow

1. Use `hkx-loop-design-check` to decide whether the task deserves a loop at all.
2. Use `loop-operator` to define checkpoints, escalation triggers, and intervention rules.
3. If the loop is substantial, write a runbook under `.pi/plans/`.
4. Return the staged loop plan, not an unbounded autonomous launch.

## Output Contract

Return:

1. recommended pattern and mode
2. stop condition
3. checkpoint strategy
4. approval gates
5. first run command or next manual step
