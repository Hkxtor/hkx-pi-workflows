---
name: hkx-session-summary
description: Generate a concise structured summary of the current session — accomplishments, decisions, files changed, issues discovered, and next steps.
argument-hint: "[--save]"
---

# /hkx-session-summary — Session Summary

Generate a structured summary of the current session. Trigger the `hkx-session-summary` skill for: `$ARGUMENTS`

## Behavior

| Argument | Mode |
|---|---|
| Empty | **Display mode** — print the summary to output |
| `--save` | **Save mode** — display and save to `.pi/sessions/session-<date>.md` |

## Summary Sections

1. **Overview** — one-paragraph summary of accomplishments
2. **Accomplishments** — list of key deliverables
3. **Decisions** — architectural choices and tradeoffs resolved
4. **Files Changed** — table of created, modified, and deleted files
5. **Issues Discovered** — bugs or technical debt found but not fixed
6. **Next Steps** — recommended follow-up tasks

## Evidence Gathering

- **Files changed**: `git diff --name-only HEAD` or `git status --short`
- **Decisions**: Check `.pi/memory/decisions/` or `docs/decisions/`
- **Test results**: Recall verification commands run during this session

## Output Template

```
=== Session Summary ===

Overview:
<one-paragraph summary>

Accomplishments:
- <outcome 1>
- <outcome 2>

Decisions:
- <decision 1>
- <decision 2>

Files:
  CREATE  path       purpose
  MODIFY  path       purpose

Issues:
- <issue description>

Next Steps:
1. <step 1>
2. <step 2>
```

---

*Part of HKX Pi Workflows*
