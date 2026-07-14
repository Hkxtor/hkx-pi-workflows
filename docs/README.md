# Documentation Index

This directory holds the package documentation for `@hkx/pi-workflows` / `hkx-pi-workflows`.

Use this page when you need to decide **which doc to open**, not when you need the full surface inventory.

## Quick Routing

| Question | Open |
| --- | --- |
| How do I install or use the package day to day? | `../README.md` or `../README.zh-CN.md` (dual path: `pi install` vs `install-global`) |
| What does official `pi install` load vs full operator install? | `../README.md` / `../README.zh-CN.md` dual-path table + `architecture.md` Discovery and Install Model |
| Where does a new surface belong (command vs skill vs agent vs chain vs extension)? | `architecture.md` |
| What currently ships in this package? | `conversion-map.md` |
| Which skill should win when several could match? | `skill-routing.md` |
| Should this be a language rule or a runtime extension? | `language-hooks.md` |
| How should maintainers change this repository? | `../AGENTS.md` |
| What global development handbook gets installed? | `../GLOBAL_AGENTS.md` |
| What global system-level tool discipline gets installed? | `../APPEND_SYSTEM.md` |

## Docs In This Directory

### `architecture.md`

Package layering and surface boundaries.

Read this when you need to decide:

- whether something is a command, skill, rule, agent, chain, or extension
- how discovery/install and mutation discipline fit together
- how the package surfaces interact at runtime

### `conversion-map.md`

Current package surface map.

Read this when you need:

- package identity
- the shipped inventory of commands, skills, rules, agents, chains, extensions, and MCP surfaces
- intentionally excluded / deferred items
- naming conventions

This is a **final-state map**, not a migration diary.

### `skill-routing.md`

Primary-skill routing for overlapping skill families.

Read this when you need to decide:

- which skill is the primary entry for research, security, UI, product, config, or session quality
- what may stack after the primary skill
- how command/skill twins should split operator entry vs reusable guidance

### `language-hooks.md`

Rule vs extension guidance for language and runtime behavior.

Read this when you need to decide:

- whether guidance belongs in `rules/`
- whether behavior must react to live tool events in `extensions/`
- how `hkx-language-quality.ts` and `hkx-gateguard.ts` are intended to behave

## Outside This Directory

These files live at the package root, but they complete the documentation set:

| File | Role |
| --- | --- |
| `../README.md` | Operator-facing homepage and installation guide (English) |
| `../README.zh-CN.md` | Operator-facing homepage and installation guide (Chinese) |
| `../AGENTS.md` | Repository maintenance rules for this package |
| `../GLOBAL_AGENTS.md` | Source for the installed global development handbook (`~/.pi/agent/AGENTS.md`) |
| `../APPEND_SYSTEM.md` | Source for the installed global system-level tool discipline (`~/.pi/agent/APPEND_SYSTEM.md`) |

## Recommended Reading Order

1. `../README.md` or `../README.zh-CN.md` — install and common workflows
2. `architecture.md` — how the package is layered
3. `conversion-map.md` — what currently ships
4. `skill-routing.md` — which skill to prefer when families overlap
5. `language-hooks.md` — only if you are changing rules or extensions
6. `../AGENTS.md` — only if you are maintaining this repository

## Scripts And Helpers

Day-to-day package scripts live in `package.json`:

- `npm run install-global` — Path B full operator install (sync surfaces, merge settings, `pi update --extensions`)
- `npm run validate` — surface contracts + dual-path manifest (`pi` + `pi-subagents`)
- `npm run mcp:apply-profile`

Official package install (Path A) is **not** an npm script:

```bash
pi install git:git@github.com:Hkxtor/hkx-pi-workflows
```

Maintenance-only helpers stay as direct `node scripts/...` invocations. The current bulk-import helper is:

- `node scripts/convert-agents-to-pi.mjs`

That helper is **not** part of normal install/runtime use. Prefer writing new agents already in the current pi-native format.

## Maintenance Rule

When you add or rename a package doc under `docs/`:

1. Update this index.
2. Update the related-docs links in `../README.md`, `../AGENTS.md`, `architecture.md`, and `conversion-map.md` when the new doc is part of the main chain.
3. Add the path to `scripts/validate.mjs` `requiredFiles` if the document is authoritative package documentation.
