---
name: instinct-accept
description: "Promote pending instincts (e.g. from legacy OM JSONL import) into personal inventory after human review."
argument-hint: "[--all | --id <id>] [--force]"
---

# /instinct-accept — Accept pending instincts

Move reviewed **pending** instincts into **personal** scope so they participate in `/evolve`.

Candidates sourced from legacy OM JSONL through `from-om` land in pending by default and are never auto-personal.

## Implementation

### Linux / macOS / Git Bash

```bash
# List pending
node scripts/instinct/cli.mjs status --pending

# Accept all pending for current project
node scripts/instinct/cli.mjs accept --all

# Accept specific ids
node scripts/instinct/cli.mjs accept --id om-abcd-prefer-functional
node scripts/instinct/cli.mjs accept om-abcd-prefer-functional

# Overwrite if personal id already exists
node scripts/instinct/cli.mjs accept --all --force
```

### Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs status --pending
node .\scripts\instinct\cli.mjs accept --all
```

## What to do

1. Run `status --pending` and summarize candidates (id, confidence, domain, trigger)
2. Ask user which to accept (or `--all` if they confirm bulk)
3. Run `accept` with chosen ids
4. Report accepted / skipped (conflicts) / missing
5. Suggest `/evolve` next

## Related

- legacy OM session import: `node scripts/instinct/cli.mjs from-om --session <path> [--dry-run]`
- skill: `instinct-evolve`
