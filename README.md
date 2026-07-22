# HKX Pi Workflows

[English](./README.md) | [中文](./README.zh-CN.md)

A pi-native workflow pack adapted from HKX / Everything Claude Code ideas.

It provides a compact core set of:

- **agents** — portable pi-subagents definitions (`hkx.<name>`)
- **chains** — reusable multi-agent workflows (`hkx-*.chain.json`)
- **commands** — operator-facing slash prompts (`commands/`; declared as `pi.prompts`)
- **skills** — workflow and language guidance
- **rules** — lightweight repo/session reminders (full install only)
- **extensions** — low-noise quality and gatekeeping helpers
- **external extension configs** — managed overlays (e.g. `pi-permission-system` config; full install only)
- **global agent settings** — `configs/agent-settings.json` → merge into `~/.pi/agent/settings.json` (full install only)
- **global context files** — install sources for `~/.pi/agent/AGENTS.md` and `~/.pi/agent/APPEND_SYSTEM.md` (full install only)

This package is intentionally small. It focuses on a useful core workflow layer for pi, not a giant catalog of framework- or domain-specific packs.

## Quick Start

There are **two install paths**. Choose based on how complete you need the operator setup to be.

### Path A — Official Pi Package (core runtime)

Install as a normal pi package from git (or a local checkout):

```bash
# recommended: pin a ref when you care about stability
pi install git:git@github.com:Hkxtor/hkx-pi-workflows
# also accepted:
pi install git:github.com/Hkxtor/hkx-pi-workflows
pi install https://github.com/Hkxtor/hkx-pi-workflows
```

This writes the package into `~/.pi/agent/settings.json` `packages` and loads **official package resources** from `package.json`:

| Manifest | What loads |
| --- | --- |
| `pi.extensions` | `extensions/*.ts` |
| `pi.skills` | `skills/` |
| `pi.prompts` | `commands/` (slash prompt templates) |
| `pi-subagents.agents` | `agents/` as package agents (`hkx.<name>`) |
| `pi-subagents.chains` | `chains/` as package chains |

**Prerequisite for agents/chains:** `pi-subagents` must already be installed (for example `pi install npm:pi-subagents`). Skills/extensions/prompts load without it.

**Not loaded by Path A:** `rules/`, `GLOBAL_AGENTS.md`, `APPEND_SYSTEM.md`, MCP merge, `configs/agent-settings.json`, and permission-system config overlays. Use Path B for those.

Update later with:

```bash
pi update --extensions
# or reinstall a new ref
pi install git:git@github.com:Hkxtor/hkx-pi-workflows@main
```

### Path B — Full operator install (`install-global`)

From a clone of this repo:

```bash
npm run install-global
```

This is the **complete** operator path. It syncs surfaces into `~/.pi/agent/`, deep-merges managed settings, runs `pi update --extensions` for packages listed in `configs/agent-settings.json`, and installs managed extension config overlays.

Use Path B when you want rules, MCP defaults, global AGENTS/APPEND_SYSTEM, and managed dependency packages — not only the package-native resources.

### Or load from the current checkout (dev / try)

```bash
pi -e .
```

Or, in `.pi/settings.json` at the package root:

```json
{
  "packages": ["."]
}
```

Local package discovery still follows `package.json` (`pi` + `pi-subagents`). Overlays still require Path B.

## Dual-path comparison

| Surface | Path A (`pi install`) | Path B (`npm run install-global`) |
| --- | --- | --- |
| extensions | yes (from package) | yes → `~/.pi/agent/extensions/` |
| skills | yes (from package) | yes → `~/.pi/agent/skills/` |
| commands / prompts | yes (`pi.prompts` → `commands/`) | yes → `commands/` **and** `prompts/` |
| agents | yes (via `pi-subagents` package discovery) | yes → `~/.pi/agent/agents/hkx/` |
| chains | yes (via `pi-subagents` package discovery) | yes → `~/.pi/agent/chains/` |
| rules | no | yes → `~/.pi/agent/rules/` |
| agent settings merge | no | yes |
| managed `packages` update | no (only this package entry) | yes (`pi update --extensions`) |
| permission config overlay | no | yes |
| GLOBAL_AGENTS / APPEND_SYSTEM | no | yes |
| MCP defaults / templates | no | yes |

## What Path B installs

| Surface | Target |
| --- | --- |
| agents | `~/.pi/agent/agents/hkx/*.md` |
| chains | `~/.pi/agent/chains/hkx-*.chain.json` |
| commands | `~/.pi/agent/commands/` and `~/.pi/agent/prompts/` |
| skills | `~/.pi/agent/skills/` |
| rules | `~/.pi/agent/rules/` |
| extensions | `~/.pi/agent/extensions/` |
| agent settings | `configs/agent-settings.json` → deep-merge into `~/.pi/agent/settings.json` (`packages` + portable defaults; preserves machine-local keys) |
| pi packages | after settings merge: `pi update --extensions` |
| permission config overlay | after package update: `configs/pi-permission-system/config.json` → `~/.pi/agent/extensions/pi-permission-system/config.json` (creates the extension dir if missing) |
| global AGENTS | `GLOBAL_AGENTS.md` → `~/.pi/agent/AGENTS.md` |
| append system | `APPEND_SYSTEM.md` → `~/.pi/agent/APPEND_SYSTEM.md` |
| MCP defaults | `.mcp.json` → merge into `~/.pi/agent/mcp.json` |
| MCP templates/catalog | `mcp-configs/` → `~/.pi/agent/hkx-pi-workflows/mcp-configs/` |
| MCP profile helper | `scripts/apply-mcp-profile.mjs` → `~/.pi/agent/hkx-pi-workflows/scripts/` |

## Common Workflows

### Review a diff or PR

- `hkx-pr-review`
- `hkx-adversarial-review`
- `hkx-security-scan`

```bash
/run-chain hkx-pr-review "Review current local diff"
```

### Implement a feature or fix a defect

- `hkx-feature-flow`
- `hkx-fix-defect`
- `hkx-refactor-flow`
- `hkx-build-fix`

```ts
subagent({
  chainName: "hkx-feature-flow",
  task: "Add thin-slice feature X",
  async: true,
  context: "fresh"
})
```

### Instinct evolve (knowledge drafts)

Cluster cross-session **instincts** into skill/command/agent drafts (Linux + Windows Node CLI):

- `/hkx-instinct-status` — list project/global instincts
- `/hkx-instinct-from-om` — map OM session reflections → **pending** instincts
- `/hkx-instinct-accept` — pending → personal (human review gate)
- `/hkx-instinct-export` / `/hkx-instinct-import` — portable bundles (+ optional ECC tree import)
- `/hkx-instinct-promote` — cross-project → global promotion (explicit `--apply`)
- `/hkx-evolve` — analyze clusters; optional `--generate` drafts under data root `evolved/`
- `/hkx-publish-draft` — preview/publish drafts into `~/.pi/agent` (requires `--apply`)
- `/hkx-instinct-decay` — weekly confidence decay (preview default; `--apply` writes)
- skill: `instinct-evolve`
- CLI: `node scripts/instinct/cli.mjs` (or `npm run instinct -- …`)

Data roots: Linux `~/.local/share/hkx-homunculus`, Windows `%LOCALAPPDATA%\hkx-homunculus`.
Drafts are never auto-installed into package `skills/`. Plan: `docs/instinct-evolve-plan.md`.

### Use a specialist agent directly

Representative agents:

- `hkx.code-reviewer`
- `hkx.security-reviewer`
- `hkx.typescript-reviewer`
- `hkx.python-reviewer`
- `hkx.go-reviewer`
- `hkx.rust-reviewer`
- `hkx.planner`
- `hkx.tdd-guide`
- `hkx.build-error-resolver`

```ts
subagent({
  agent: "hkx.code-reviewer",
  task: "Review the current local diff. Do not modify files.",
  context: "fresh",
  async: true
})
```

## Tooling Assumptions

These agents and chains are tuned for:

- **pi-fff**: `fffind`, `ffgrep`, `fff-multi-grep`
- **pi-lens**: `lsp_diagnostics`, `lsp_navigation`, `ast_grep_search`, `ast_grep_replace`
- core file and shell tools: `read`, `edit`, `write`, `ls`, `bash`

In short: search with pi-fff, reason about code with pi-lens, mutate narrowly.

## Context File Split

- `AGENTS.md` — repository-specific maintenance rules for this package
- `GLOBAL_AGENTS.md` — generic global development handbook installed to `~/.pi/agent/AGENTS.md`
- `APPEND_SYSTEM.md` — short system-level tool-discipline append

## Scripts

### Day-to-day package scripts

| Script | Purpose |
| --- | --- |
| `npm run install-global` | Full operator install into `~/.pi/agent/` (Path B) |
| `npm run validate` | Validate package surfaces, frontmatter, dual-path manifest, and MCP catalog invariants |
| `npm test` | Run versioned smoke suites under `scripts/tests/` (merge + env-resolver) |
| `npm run mcp:apply-profile` | Apply MCP template profiles |

### Maintenance-only helpers

These are **not** part of the normal install/runtime path and are not exposed as npm scripts.

| Helper | Purpose |
| --- | --- |
| `node scripts/convert-agents-to-pi.mjs` | Bulk-import older agent definitions into the current pi-subagents format. Prefer writing new agents as pi-native from the start. |

## Validation

```bash
npm run validate
npm test
```

`npm test` runs the versioned smoke suite in `scripts/tests/` (MCP merge contract + env-var resolver / placeholder / args-url guards). Local scratch under `scripts/_smoke/` is gitignored and is not part of the package gate.

## Design Principles

- portable pi-native agents and chains
- compact, reusable workflow surfaces
- read-only reviewers and scoped writer agents
- additive MCP configuration instead of heavy installer logic
- optional packs stay out of the core package

## Related Docs

- `README.zh-CN.md` — Chinese operator homepage (same dual-path install model)
- `docs/README.md` — documentation index and routing guide
- `docs/architecture.md` — package layering and surface boundaries
- `docs/conversion-map.md` — current package surface map
- `docs/skill-routing.md` — primary skill choice when families overlap
- `docs/language-hooks.md` — how language rules and runtime extensions divide responsibility
- `AGENTS.md` — repository maintenance rules
- `GLOBAL_AGENTS.md` — global development handbook source
- `APPEND_SYSTEM.md` — global system-level tool discipline source
