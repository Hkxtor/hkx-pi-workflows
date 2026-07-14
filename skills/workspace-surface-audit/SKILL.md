---
name: hkx-workspace-surface-audit
description: "Read-only workspace inventory: repo stack, MCP, plugins, extensions, skills, commands, rules, env surfaces, and missing operator workflows. Use for \"what do we have installed?\" maps. Not skill-quality stocktake, automation-lane audit, security scan, or confirm-delete cleanup (config-gc)."
origin: HKX-converted-for-Pi
---

# HKX Workspace Surface Audit For Pi

Use to answer: what can this workspace do right now, and what should be enabled
or built next?

## Rules

- Never print secret values.
- Surface only key names, provider names, file paths, and presence/absence.
- Stay read-only unless the user approves a concrete change.
- Separate available now, primitive-only, and missing.
- Prefer Pi-native commands, skills, rules, extensions, and MCPs over generic
  extra tooling when Pi can own the workflow.

## Inputs

Inspect only relevant files:

- `package.json`, lockfiles, language manifests
- `README.md`, `AGENTS.md`, project docs
- `.pi/` config, commands, skills, rules, extensions
- MCP configs
- LSP/tool configs
- CI workflows
- `.env*` key names, not values

## Output Sections

1. Current surface
   - available tools and workflows
2. Parity
   - what the workspace already covers well
3. Primitive-only gaps
   - capability exists but lacks a clean workflow
4. Missing integrations
   - not available yet
5. Top next moves
   - 3-5 highest-impact Pi-native additions

## Recommendation Shape

| Gap | Preferred shape |
| --- | --- |
| repeatable operator workflow | skill or command |
| automatic reminder/enforcement | rule or extension |
| external bridge | MCP server or extension |
| setup/install guidance | audit or setup skill |
| project-specific policy | AGENTS.md or rule |

## Output

```text
Current surface:
Parity:
Primitive-only gaps:
Missing integrations:
Top next moves:
```
