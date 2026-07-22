---
name: hkx-instinct-status
description: "List project and global instincts with confidence and domain (Linux and Windows)."
argument-hint: "[--pending]"
---

# /hkx-instinct-status — Instinct inventory

Show learned instincts for the current project and global scope.

## Implementation

### Linux / macOS / Git Bash

```bash
node scripts/instinct/cli.mjs status
node scripts/instinct/cli.mjs status --pending
node scripts/instinct/cli.mjs status --json
```

### Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs status
node .\scripts\instinct\cli.mjs status --json
```

## What to do

1. Run `status` (add `--pending` if reviewing unaccepted OM candidates later)
2. Summarize counts by domain and scope
3. Flag low-confidence items and empty inventory
4. Suggest `/hkx-evolve` when total ≥ 3

## Data roots

- Linux: `~/.local/share/hkx-homunculus`
- Windows: `%LOCALAPPDATA%\hkx-homunculus`
- Override: `HKX_HOMUNCULUS_DIR` (absolute)
