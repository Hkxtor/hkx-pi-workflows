---
description: "How OM V3 session memory maps to pending instincts (Phase 2)."
---

# OM adapter

## Source

Pi session JSONL custom entries:

- `om.observations.recorded`
- `om.reflections.recorded`
- `om.observations.dropped`

Folded with full tip projection (recorded entries whose `coversUpToId` is in the session, then apply drops to observations).

## Mapping (rules only)

| Signal | Instinct field |
| --- | --- |
| reflection.content | Action + trigger seed |
| supportingObservationIds | Evidence + confidence |
| max support relevance | confidence boost; filter via `--min-relevance` |
| preference/decision language | required for candidate (else skip) |

Default output: **pending/** only. Accept explicitly.

## CLI

```bash
node scripts/instinct/cli.mjs from-om --session <file> [--dry-run] [--min-relevance medium]
node scripts/instinct/cli.mjs accept --all
```
