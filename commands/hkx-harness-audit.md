---
description: Audit the local Pi harness surface — prompts, skills, commands, MCP, extensions, and safety layers — and return a prioritized scorecard with next moves.
argument-hint: "[repo|skills|commands|agents|mcp|extensions|all]"
---

# HKX Harness Audit For Pi

Run an Pi-native harness audit for: `$ARGUMENTS`

Default scope is `repo`.

## Scope Modes

| Scope | Focus |
|---|---|
| `repo` | Overall harness surface for the current repository |
| `skills` | Skill portfolio quality, overlap, and discoverability |
| `commands` | Command coverage, wrappers, and stale workflow text |
| `agents` | Agent catalogue quality, coverage, and invocation fit |
| `mcp` | `.mcp.json`, MCP defaults, and reference-catalog drift |
| `extensions` | Extension modules, pre-action safety, and runtime ergonomics |
| `all` | Full package-level audit across every surface above |

## Audit Method

This command is advisory, not a deterministic ECC script wrapper.

Use Pi-native evidence:

- `AGENTS.md`, `APPEND_SYSTEM.md`, `.pi/settings.json`, and `.mcp.json`
- `commands/`, `skills/`, `rules/`, `extensions/`, `agents/`
- README and conversion-map accuracy
- validator coverage and package consistency

Pair these components as needed:

- `harness-optimizer` for highest-leverage configuration changes
- `hkx-workspace-surface-audit` for repo/plugin/MCP surface inventory
- `hkx-agent-architecture-audit` when prompt/tool/memory/retry layers need deeper review

## Output Contract

Return:

1. `Current Surface`
2. `Findings`
3. `Top 3 Next Moves`
4. `Risks / Drift`
5. `Overall Status` — `healthy`, `workable`, or `needs work`
