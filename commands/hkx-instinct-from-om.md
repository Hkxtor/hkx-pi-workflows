---
name: hkx-instinct-from-om
description: "Map pi-observational-memory session reflections into pending instincts (dry-run safe)."
argument-hint: "[--session path] [--dry-run] [--min-relevance medium]"
---

# /hkx-instinct-from-om — OM session -> pending instincts

Read a Pi session JSONL (OM V3 custom entries), fold observations/reflections, and map actionable reflections into **pending** instincts.

Does **not** write personal instincts. Review with `status --pending`, then `/hkx-instinct-accept`.

## Implementation

### Linux / macOS / Git Bash

```bash
# Latest session for current cwd (if sessions exist under ~/.pi/agent/sessions)
node scripts/instinct/cli.mjs from-om --dry-run

# Explicit session file
node scripts/instinct/cli.mjs from-om --session /path/to/session.jsonl --dry-run
node scripts/instinct/cli.mjs from-om --session /path/to/session.jsonl

# Stricter filter
node scripts/instinct/cli.mjs from-om --session ./sess.jsonl --min-relevance high
```

### Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs from-om --session C:\path\session.jsonl --dry-run
node .\scripts\instinct\cli.mjs from-om --session C:\path\session.jsonl
```

## What to do

1. Prefer explicit `--session` path; else resolve latest session for cwd
2. Always offer `--dry-run` first and show candidate count + skipped reasons
3. On confirm, run without dry-run (writes pending only)
4. Point user to `/hkx-instinct-accept` before evolve

## Notes

- Sessions live under `~/.pi/agent/sessions/` (override `HKX_PI_SESSIONS_DIR`)
- Run CLI in the same OS environment as Pi (no silent WSL path bridging)
- Fallback: user can paste `/om:view full` content manually later; this command is file-based

## Related

- `/hkx-instinct-accept`
- `/hkx-evolve`
- skill `instinct-evolve` references/om-adapter.md
