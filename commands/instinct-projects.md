---
name: instinct-projects
description: "List known instinct projects with personal/inherited/pending counts and global totals."
argument-hint: "[--json]"
---

# /instinct-projects

List the instinct **project registry** and per-project statistics.

## GateGuard (create)

1. Loaded via `package.json` `pi.prompts` → `./commands`; Path B install links commands/prompts.
2. Surfaces: slash prompt; delegates to `scripts/instinct/cli.mjs projects` (listProjectStats).
3. Formats: projects.json + projects/<12-hex>/instincts/{personal,inherited,pending}; optional observations.jsonl.
4. Auth: user "接按 P0 开实现" (ECC `/projects` port).
5. Verify: CLI projects --json; npm test; npm run validate.

## What it shows

For each known project (from `projects.json` + `projects/<id>/`):

- Name, id, remote, source
- Instinct counts: personal / inherited / pending
- Observation event count (`observations.jsonl` if present)
- Last seen / updated timestamp

Also prints **GLOBAL** personal / inherited / pending totals.

## Linux / macOS / Git Bash

```bash
node scripts/instinct/cli.mjs projects
node scripts/instinct/cli.mjs projects --json
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs projects
node .\scripts\instinct\cli.mjs projects --json
```

## What to do

1. Run from the package root (or installed Path B copy under `~/.pi/agent/hkx-pi-workflows/`)
2. Summarize project count and any projects with large pending queues
3. If pending is high, suggest `/instinct-status`, `/instinct-accept`, or `/instinct-prune`
4. If the current repo is missing from the list, run learn / init / from-om once so `ensureLayout` registers it

## Data roots

- Linux: `~/.local/share/hkx-homunculus` (or `$XDG_DATA_HOME/hkx-homunculus`)
- Windows: `%LOCALAPPDATA%\hkx-homunculus`
- Override: `HKX_HOMUNCULUS_DIR` (absolute)

## Notes

- Read-only: does not delete or promote instincts
- Running from a git repo warms the current project entry via `ensureLayout`
