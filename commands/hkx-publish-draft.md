---
name: hkx-publish-draft
description: "Publish instinct-evolved drafts from data-root evolved/ into Pi agent surfaces with explicit --apply."
argument-hint: "[--apply] [--force] [--kind skill|command|agent] [--name n] [--target dir]"
---

# /hkx-publish-draft

Copy reviewed `evolved/` drafts into the **user** Pi agent directory (default `~/.pi/agent`).

**Default is preview only.** Writes require `--apply`.

## Destinations

| Draft kind | Destination under publish root |
| --- | --- |
| skill | `skills/<name>/SKILL.md` |
| command | `prompts/<name>.md` (+ mirror `commands/<name>.md`) |
| agent | `agents/hkx/<name>.md` |

Default publish root: `~/.pi/agent` (override `--target` or `HKX_PUBLISH_ROOT`).

Refuses publishing into the `@hkx/pi-workflows` package tree unless `--force`.

## Linux / macOS / Git Bash

```bash
# After evolve --generate
node scripts/instinct/cli.mjs publish-draft
node scripts/instinct/cli.mjs publish-draft --kind skill
node scripts/instinct/cli.mjs publish-draft --name new-functions --apply
node scripts/instinct/cli.mjs publish-draft --apply --force
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs publish-draft
node .\scripts\instinct\cli.mjs publish-draft --apply
```

## What to do

1. Ensure drafts exist (`evolve --generate`)
2. Run preview; show create/update/blocked paths and hashes
3. Ask user to confirm before `--apply`
4. On conflicts, require `--force` for overwrite
5. Remind: published skills still need `/reload` or new session to pick up

## Related

- `/hkx-evolve --generate`
- skill `instinct-evolve`
