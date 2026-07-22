---
name: hkx-instinct-promote
description: "List or apply promotion of cross-project high-confidence instincts to global scope."
argument-hint: "[--apply] [--id <id>] [--dry-run] [--force]"
---

# /hkx-instinct-promote

Project → global promotion when the same instinct id appears in **2+ projects** with average confidence **≥ 80%**.

Default is **list only**. Writes only with `--apply` (or explicit `--id` + `--apply`).

## Linux / macOS / Git Bash

```bash
# List candidates
node scripts/instinct/cli.mjs promote

# Apply all candidates
node scripts/instinct/cli.mjs promote --apply

# Preview / apply one id
node scripts/instinct/cli.mjs promote shared-pref
node scripts/instinct/cli.mjs promote --id shared-pref --apply
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs promote
node .\scripts\instinct\cli.mjs promote --apply
```

## Safety

- No auto-promote without `--apply`
- Skips ids already global (unless `--force`)
- Writes to global `instincts/personal/` with provenance footer
