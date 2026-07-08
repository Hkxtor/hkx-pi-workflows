---
description: Recommend the best OMP model role or execution tier for the current task based on complexity, risk, and budget.
argument-hint: "[task description] [--budget low|med|high]"
---

# HKX Model Route For OMP

Recommend an OMP model route for: `$ARGUMENTS`

## Routing Targets

Use OMP model roles and runtime tiers, not Claude-specific product names:

- `smol` — cheap classification, tiny transforms, low-risk mechanical work
- `default` — normal implementation, edits, and day-to-day repo tasks
- `slow` — deep review, architecture, ambiguous debugging, complex reasoning
- `plan` — up-front decomposition, design, or plan-first work
- `/fast on` — optional service-tier acceleration when the provider supports it

## Heuristic

- choose `smol` for deterministic, low-blast-radius tasks;
- choose `default` for ordinary coding and doc updates;
- choose `slow` for risky, ambiguous, or cross-cutting work;
- choose `plan` first when the task should be decomposed before editing.

## Required Output

Return:

1. recommended role
2. confidence level
3. why it fits this task
4. fallback role if the first pass stalls
5. whether `/fast on` helps or just burns budget
