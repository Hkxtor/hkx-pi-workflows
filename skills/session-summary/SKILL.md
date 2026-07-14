---
name: hkx-session-summary
description: Generate a concise, structured summary of the current Pi session — key accomplishments, decisions made, files changed, issues discovered, and next steps. Uses LLM summarization of session transcript for rich context.
version: 1.0.0
origin: ECC-converted-for-Pi
---

# HKX Session Summary

Generate a structured summary of the current session's work. The summary captures key accomplishments, decisions, files changed, issues discovered, and recommended next steps.

This is adapted from ECC's `session-summary` stop hook and `llm-summary.js` generator. In Pi, it runs as a deliberate end-of-session or checkpoint command rather than an automatic hook.

## When to Activate

- At the end of a session, before wrapping up.
- After completing a complex multi-step task.
- When the user asks "what did we do?" or "summarize this session."
- To create a checkpoint record before switching contexts.
- When triggered via `/hkx-session-summary`.

## Summary Structure

Generate a structured summary covering these sections:

### 1. Session Overview

A one-paragraph summary of what was accomplished.

### 2. Key Accomplishments

List the main deliverables and outcomes, with file paths and brief descriptions.

### 3. Decisions Made

Record any architectural decisions, design choices, or tradeoffs resolved during the session. Link to ADRs when applicable.

### 4. Files Changed

Tabulate created, modified, and deleted files:

| Action | File | Purpose |
|---|---|---|
| CREATE | `src/lib/auth.ts` | Token validation middleware |
| MODIFY | `src/api/route.ts` | Added auth guard to endpoints |
| DELETE | `src/legacy/auth.py` | Replaced by TypeScript version |

### 5. Issues Discovered

Any bugs, regressions, or technical debt found during the session that were not fixed.

### 6. Next Steps

Recommended follow-up tasks or unresolved items.

### 7. Metrics (optional)

- Files created / modified / deleted
- Tests added / passed / failed
- Review dimensions run and findings

## Output Template

```text
=== Session Summary ===

Overview:
<one-paragraph summary>

Accomplishments:
- <outcome 1>
- <outcome 2>

Decisions:
- <decision 1> (see docs/decisions/<adr>.md)
- <decision 2>

Files:
  CREATE  path/to/file           purpose
  MODIFY  path/to/file           purpose
  DELETE  path/to/file           purpose

Issues:
- <issue 1 description>

Next Steps:
1. <step 1>
2. <step 2>
```

## Gathering Evidence

Use the following approaches to build the summary:

1. **Files changed**: `git diff --name-only HEAD` or `git status --short`.
2. **Decisions**: Check for ADRs in `docs/decisions/` or `docs/adr/`.
3. **Test results**: Recall verification commands run during the session.
4. **Conversation context**: The summary should reflect work done during this session, captured from the operator's own knowledge of what was accomplished.

## Persistence

When the user wants to persist the summary:

1. Write to `.pi/sessions/session-<date>.md`.
2. Or append to `.pi/memory/output-index.md`.

Do not persist without explicit user approval.

## Related

- `hkx-agent-self-evaluation` — Quality assessment of delivered work
- `hkx-delivery-gate` — Pre-completion checklist
- `hkx-growth-log` — Learning capture methodology
- `hkx-architecture-decision-records` — ADR creation workflow
