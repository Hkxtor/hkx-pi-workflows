---
name: instinct-evolve
description: "Maintain cross-session instinct inventory and cluster them into skill/command/agent drafts. Use for /evolve, instinct status, or promoting session patterns into reusable assets. Linux and Windows supported via Node CLI."
version: 1.0.0
origin: HKX-native-for-Pi
---

# Instinct Evolve

Pi-native **instinct inventory + evolve-to-draft** loop for storing **cross-session** atomic behaviors and clustering them into draft skills/commands/agents.

## When to Activate

- User runs `/evolve` or asks to cluster learned patterns into skills
- Reviewing project/global instincts and confidence
- Preparing drafts under `evolved/` before promoting to formal skills
- Discussing continuous learning / instincts on Pi (not Claude Code hooks)

### Do Not Use When

- Need to import observations from a legacy OM session JSONL → use `/instinct-from-om` first
- Extract patterns from **git history** only → `/skill-create`
- Writing a human growth journal → `growth-log` skill

## Architecture

```text
Legacy OM session JSONL  --(optional adapter)-->  Instinct store  --(/evolve)-->  evolved/ drafts
```

| Layer | Role |
| --- | --- |
| Legacy OM session JSONL | Optional import source for prior-session observations/reflections |
| Instinct store | Cross-session YAML/MD instincts (project + global) |
| Evolve | Cluster → skill/command/agent **drafts** only |

## CLI

From package root (Linux / macOS / Git Bash):

```bash
node scripts/instinct/cli.mjs init
node scripts/instinct/cli.mjs status
node scripts/instinct/cli.mjs evolve
node scripts/instinct/cli.mjs evolve --generate
```

Windows PowerShell:

```powershell
node .\scripts\instinct\cli.mjs init
node .\scripts\instinct\cli.mjs evolve --generate
```

Env:

| Variable | Meaning |
| --- | --- |
| `HKX_HOMUNCULUS_DIR` | Absolute data root override |
| `HKX_PROJECT_ID` | Force 12-hex project id |

Default data roots:

- Linux: `~/.local/share/hkx-homunculus` (or `$XDG_DATA_HOME/hkx-homunculus`)
- Windows: `%LOCALAPPDATA%\hkx-homunculus`

See [references/platforms.md](references/platforms.md).

## Instinct file shape

```yaml
---
id: prefer-functional
trigger: "when writing new functions"
confidence: 0.7
domain: code-style
source: manual
scope: project
---

# Title

## Action
What to do.

## Evidence
Why we believe this.
```

Rules: body must not use bare `---`; ids are `[a-z0-9][a-z0-9._-]*` (Windows-safe).

## Evolve rules (summary)

- Need ≥ 3 instincts
- Skill: same normalized trigger cluster size ≥ 2
- Command: `domain: workflow` and confidence ≥ 0.7
- Agent: cluster size ≥ 3 and avg confidence ≥ 0.75
- `--generate` writes only under data-root `evolved/` — **never** auto-installs package skills

## Confidence decay

ECC-compatible weekly decay for inactive instincts:

```bash
node scripts/instinct/cli.mjs decay              # preview
node scripts/instinct/cli.mjs decay --apply      # write confidence + updated
```

- Rate: `-0.02` / full inactive week (override `--rate`)
- Floor: `0.1` (override `--floor`)
- Activity: `last_seen` → `updated` → `created` → mtime

## Prune pending + project stats

```bash
node scripts/instinct/cli.mjs prune              # preview expired pending (TTL 30d)
node scripts/instinct/cli.mjs prune --apply      # delete expired pending only
node scripts/instinct/cli.mjs projects           # registry + personal/inherited/pending counts
```

- Pending age: `created` → `updated` → `last_seen` → mtime
- Does not delete personal/inherited (use decay for confidence)
- Commands: `/instinct-prune`, `/instinct-projects`

## Memory vault (M1)

Optional **context** store on the **same** `hkx-homunculus` root (not a second data root). Orthogonal to instincts:

| Layer | What it stores |
| --- | --- |
| Legacy OM session JSONL | Optional import source for prior-session observations/reflections |
| Memory vault | Project/user decisions, constraints, notes (`hkx.memory.v1`) |
| Instinct store | Cross-session **triggerable** behaviors (pending → personal) |

```bash
node scripts/instinct/cli.mjs memory recall
node scripts/instinct/cli.mjs memory save --title "Decision" --body "..."   # preview
node scripts/instinct/cli.mjs memory save --title "Decision" --body "..." --apply
node scripts/instinct/cli.mjs memory validate
```

- Layout: `projects/<id>/memory/`, `memory/user/` (team dir stub only; no writes in M1)
- Default recall scope: **project** (user only with `--scope user`)
- `from-om` default: **pending instincts only**; opt-in `--to vault|both`
- Vault handoff / promote: `memory handoff`, `memory promote-instinct` (skill `unified-memory`, `/unified-memory`)
- Slash: `/unified-memory`

## Publish drafts

```bash
node scripts/instinct/cli.mjs evolve --generate
node scripts/instinct/cli.mjs publish-draft              # preview
node scripts/instinct/cli.mjs publish-draft --apply      # write to ~/.pi/agent
```

Default target is user Pi agent dir — not the package `skills/`.

## Transfer & promote (Phase 3)

```bash
node scripts/instinct/cli.mjs export --scope project --output ./bundle.md
node scripts/instinct/cli.mjs import ./bundle.md --dry-run
node scripts/instinct/cli.mjs promote
node scripts/instinct/cli.mjs promote --apply
```

## Legacy OM JSONL import (Phase 2)

```bash
node scripts/instinct/cli.mjs from-om --session /path/to/session.jsonl --dry-run
node scripts/instinct/cli.mjs from-om --session /path/to/session.jsonl
node scripts/instinct/cli.mjs from-om --session /path/to/session.jsonl --to vault --dry-run
node scripts/instinct/cli.mjs status --pending
node scripts/instinct/cli.mjs accept --all
```

See [om-adapter.md](references/om-adapter.md).

## Operator flow

1. `init` / ensure layout
2. Add instincts:
   - manual under `projects/<id>/instincts/personal/` (or global)
   - session extract: `/learn` or quality-gated `/learn-eval` → **pending**
   - legacy OM session file: `/instinct-from-om` → **pending**
3. `/instinct-accept` after human review of pending
4. `status` to review personal inventory
5. `evolve` to analyze; `evolve --generate` for drafts
6. Human review drafts → optional formal skill via skill-create / manual copy / publish-draft

## References

- [schema.md](references/schema.md)
- [thresholds.md](references/thresholds.md)
- [platforms.md](references/platforms.md)
- Plan: `docs/instinct-evolve-plan.md`
