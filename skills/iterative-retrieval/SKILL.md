---
name: hkx-iterative-retrieval
description: Pi pattern for progressively refining repository context before delegating to agents or implementing changes.
origin: HKX-converted-for-Pi
---

# HKX Iterative Retrieval For Pi

Use this when the first search cannot reliably identify all context needed for a task, especially before spawning agents or changing code across unfamiliar areas.

## Triggers

- Delegating to `task` agents that need repo context.
- Investigating bugs where terminology is unknown or inconsistent.
- Planning changes across several modules, packages, routes, tools, or schemas.
- Avoiding both overloading agents with entire directories and under-specifying their assignments.

## Loop

Run at most three focused cycles before deciding the best available context is enough or the task is blocked.

1. **Dispatch**
   - Start broad with `find` for likely files and `search` for user-facing terms, API names, errors, types, config keys, and domain nouns.
   - Include tests, docs, and schemas when the behavior has contracts.
2. **Evaluate**
   - Read only candidate files or ranges needed to classify relevance.
   - Mark each candidate as high, medium, low, or irrelevant.
   - Record missing context explicitly: caller, callee, schema, fixture, migration, command, UI route, or test.
3. **Refine**
   - Add terminology discovered in high-relevance files.
   - Search for imports, references, route registration, exported symbols, generated types, config keys, and tests.
   - Exclude paths proven irrelevant.
4. **Stop and package**
   - Stop when high-relevance files cover entry point, behavior, data shape, and verification path.
   - If gaps remain after three cycles, state the gap instead of guessing.

## Agent Handoff

When delegating, include:

```text
Task:
Known relevant files:
Important symbols or routes:
Repository conventions observed:
Missing context already checked:
Non-goals:
Acceptance / verification:
```

Do not ask a subagent to rediscover broad context unless discovery is the assignment. Give it the narrowed file set, exact symbols, and what to verify.

## Guardrails

- Search before reading large files.
- Read sections, not whole trees.
- Prefer local evidence over memory or naming guesses.
- Do not let the loop become research theater; three cycles is the default cap.
- If a search channel is unavailable or suspiciously empty, retry with different terms before concluding absence.

## Output

```text
Retrieval cycles:
High relevance:
Medium relevance:
Excluded:
Remaining gaps:
Next action:
```
