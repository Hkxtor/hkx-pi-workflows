---
name: instinct-prune
description: "Preview or delete pending instincts older than the TTL (default 30 days; never auto-promoted)."
argument-hint: "[--apply] [--max-age 30] [--scope project|global|all] [--as-of YYYY-MM-DD] [--json]"
---

# /instinct-prune

Remove **pending** instincts that were never accepted/promoted and are older than the TTL.

## GateGuard (create)

1. Loaded via `package.json` `pi.prompts` → `./commands`; Path B `install.mjs` links into `~/.pi/agent/commands` and `prompts/`.
2. Surfaces: slash prompt only; delegates to `scripts/instinct/cli.mjs prune` (planPrune/applyPrune).
3. Formats: TTL days int (default 30); age from created/updated/last_seen/mtime; preview default + `--apply`.
4. Auth: user "接按 P0 开实现" (ECC `/prune` port).
5. Verify: `node scripts/instinct/cli.mjs prune --help` via help text; `npm test`; `npm run validate`.

## Model (ECC parity + hkx safety)

- Default TTL: **30 days** (override with `--max-age`)
- Age anchor precedence: `created` → `updated` → `last_seen` → file mtime
- Scope: all project pending dirs + global pending (default `--scope all`)
- **Preview by default** — require `--apply` to delete (stricter than ECC `/prune`)

Does **not** touch personal/inherited instincts. Use `/instinct-decay` to lower confidence on those.

## Linux / macOS / Git Bash

```bash
# Preview only (default)
node scripts/instinct/cli.mjs prune
node scripts/instinct/cli.mjs prune --json

# Custom TTL
node scripts/instinct/cli.mjs prune --max-age 60

# Delete after review
node scripts/instinct/cli.mjs prune --apply

# Current project pending only
node scripts/instinct/cli.mjs prune --scope project --apply
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs prune
node .\scripts\instinct\cli.mjs prune --apply
```

## What to do

1. Run preview; list id, age days, scope/project, created source
2. Confirm with the user before `--apply` (this permanently deletes pending files)
3. After apply, re-run `/instinct-status` (with pending) and `/instinct-projects`
4. Prefer `/instinct-accept` for still-useful pending items instead of letting them expire

## Notes

- `--dry-run` forces preview even if `--apply` is also present
- `--as-of` is for audits/tests (evaluate age as of a fixed date)
- Failed deletes are reported; exit code is non-zero if any fail
