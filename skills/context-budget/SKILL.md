---
name: hkx-context-budget
description: "Audit Pi context overhead across agents, skills, rules, prompts, MCP, and AGENTS files. Flag bloat and rank token-saving actions. Use when sessions feel heavy or before adding surfaces."
version: 1.0.0
origin: ECC-converted-for-Pi
---

# Context Budget (Pi)

Inventory token tax from installed Pi surfaces and recommend cuts.

Operator entry: `/hkx-context-budget`.

## When to Activate

- Sessions feel sluggish or quality drops mid-run
- After adding many skills, agents, MCP servers, or rules
- Checking headroom before expanding the install surface
- Path A vs Path B install hygiene

## Scan roots (in order)

Prefer the active install, then the package checkout:

| Surface | Typical paths |
| --- | --- |
| Skills | `~/.pi/agent/skills/*/SKILL.md`, package `skills/*/SKILL.md` |
| Agents | `~/.pi/agent/agents/**/*.md`, package `agents/*.md` |
| Commands/prompts | `~/.pi/agent/commands/*.md`, `~/.pi/agent/prompts/*.md`, package `commands/*.md` |
| Rules | `~/.pi/agent/rules/**/*.md`, package `rules/**/*.md` (Path B) |
| Global context | `~/.pi/agent/AGENTS.md`, `APPEND_SYSTEM.md` |
| MCP | `~/.pi/agent/mcp.json`, project `.pi/mcp.json`, package `.mcp.json` |
| Settings | `~/.pi/agent/settings.json` (`packages`, compaction, observational-memory) |

Skip identical duplicates (same path hash / same content) to avoid double-count.

## Estimation heuristics

- Prose: `words × 1.3`
- Code-heavy: `chars / 4`
- MCP tool schema: ~500 tokens per tool (order-of-magnitude)
- Always-loaded descriptions (agent frontmatter) count even if the agent never runs

## Flags

| Flag | Signal |
| --- | --- |
| Heavy agent | `>200` lines |
| Bloated agent description | description `>30` words |
| Heavy skill | `SKILL.md` `>400` lines |
| Heavy rule | `>100` lines |
| MCP over-subscribe | `>10` servers, or server wrapping a pure CLI (`gh`, `git`, `npm`) |
| Global AGENTS bloat | `>300` lines combined with APPEND_SYSTEM |

## Classify

| Bucket | Action |
| --- | --- |
| Always needed | Keep (daily workflow, active stack) |
| Sometimes needed | Lazy / on-demand skill only |
| Rarely needed | Remove from default load / Path B rules / MCP defaults |

## Report template

```text
Context Budget Report
=====================
Total estimated overhead: ~N tokens

| Component | Count | ~Tokens |
| --- | ---: | ---: |
| Agents |  |  |
| Skills |  |  |
| Commands |  |  |
| Rules |  |  |
| MCP tools |  |  |
| AGENTS/APPEND |  |  |

Issues (ranked by savings):
1. ...
2. ...

Top 3 optimizations:
1. [action] → save ~X tokens
2. ...
3. ...

Potential savings: ~X tokens
```

Verbose mode: per-file table for the heaviest 15 files + MCP server/tool list.

## Practical levers (Pi)

1. Prefer Path A package resources over loading every Path B rule/MCP default
2. Drop CLI-wrapping MCP servers; use skills + `bash`/`gh`
3. Shorten agent `description` frontmatter (always in spawn context)
4. Move rare playbooks out of always-loaded rules into on-demand skills
5. Compact at phase boundaries (`strategic-compact`) — budget audit does not replace compaction

## Integration

| Surface | Relationship |
| --- | --- |
| `workspace-surface-audit` | What is installed |
| `skill-stocktake` / `config-gc` | Portfolio quality / confirmed deletion |
| `strategic-compact` | Mid-session context hygiene |

## Notes

- Origin: ECC `context-budget`, rewritten for `~/.pi/agent` dual-path installs
- Estimates are decision aids, not billing-grade metering
