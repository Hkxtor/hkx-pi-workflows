---
name: hkx-evolve
description: "Analyze instinct inventory and suggest or generate skill/command/agent drafts (Linux and Windows)."
argument-hint: "[--generate]"
---

# /hkx-evolve — Cluster instincts into drafts

Analyze cross-session **instincts** and cluster related ones into higher-level structures:

- **Skills** — auto-triggered pattern clusters
- **Commands** — user-invoked workflow instincts
- **Agents** — larger high-confidence clusters

Drafts go under the data-root `evolved/` only. **Never** auto-install into package `skills/`.

## Implementation

Use `Bash` to run the Node CLI from the hkx-pi-workflows package (or installed copy under `~/.pi/agent/hkx-pi-workflows/`).

### Linux / macOS / Git Bash

```bash
# From package root, or absolute path to installed scripts
node scripts/instinct/cli.mjs evolve
node scripts/instinct/cli.mjs evolve --generate
node scripts/instinct/cli.mjs evolve --json
```

### Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs evolve
node .\scripts\instinct\cli.mjs evolve --generate
```

### Env

```bash
# Linux absolute override
HKX_HOMUNCULUS_DIR=/tmp/hkx-h node scripts/instinct/cli.mjs evolve
```

```powershell
$env:HKX_HOMUNCULUS_DIR="D:\data\hkx-h"
node .\scripts\instinct\cli.mjs evolve
```

## What to do

1. Detect project (git remote / `HKX_PROJECT_ID`) via CLI
2. Ensure layout (`init` if first run)
3. Confirm ≥ 3 instincts exist (`status`); if not, help user add fixtures or manual instincts
4. Run `evolve` and present skill/command/agent candidates
5. If user asked for generation, run `--generate` and list written paths under data root
6. Remind: review drafts before any formal skill promotion

## Related

- `/hkx-instinct-status` — list inventory
- skill `instinct-evolve` — schema and thresholds
- Plan: `docs/instinct-evolve-plan.md`
