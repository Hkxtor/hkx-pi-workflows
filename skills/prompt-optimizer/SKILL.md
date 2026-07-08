---
name: hkx-prompt-optimizer
description: Analyze a draft prompt, identify missing context and workflow gaps, match it to OMP commands/skills/agents, and output a stronger prompt the user can paste.
origin: ECC-converted-for-OMP
---

# Prompt Optimizer

Use this skill when the user wants to improve a prompt rather than execute the
task directly.

This is advisory only. Do **not** implement the task while inside this skill.

## What To Do

1. classify the user's intent:
   - feature
   - bug fix
   - refactor
   - research
   - testing
   - review
   - documentation
   - infrastructure
2. estimate scope:
   - trivial
   - low
   - medium
   - high
3. detect missing context:
   - target files or surface
   - acceptance criteria
   - validation expectations
   - risks and constraints
   - what must stay out of scope
4. map the task to the right OMP components:
   - commands
   - skills
   - agents
5. output a ready-to-paste improved prompt.

## Output Shape

Return:

1. `Prompt Diagnosis`
2. `Missing Context`
3. `Recommended OMP Components`
4. `Optimized Prompt`

## Optimization Rules

- make scope explicit
- name affected surfaces
- define success and validation
- state constraints and out-of-scope items
- choose the right workflow entrypoint (`/hkx-plan`, `/hkx-orch-fix-defect`, skills, or agents)
- keep the final prompt concrete enough that the next agent can act without guessing

## Do Not Use When

- the user clearly wants the task executed now
- the request is actually code or performance optimization rather than prompt optimization

## Related Skills

- `hkx-plan-orchestrate` when the improved prompt should chain multiple agents
- `hkx-search-first` when the prompt needs research-before-coding guidance
