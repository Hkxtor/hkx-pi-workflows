# HKX Pi Workflows

A pi-native workflow pack adapted from HKX / Everything Claude Code ideas.

It provides a compact core set of:

- **agents** — portable pi-subagents definitions (`hkx.<name>`)
- **chains** — reusable multi-agent workflows (`hkx-*.chain.json`)
- **commands** — operator-facing slash-command guidance
- **skills** — workflow and language guidance
- **rules** — lightweight repo/session reminders
- **extensions** — low-noise quality and gatekeeping helpers
- **external extension configs** — managed overlays (e.g. `pi-permission-system` config)
- **global agent settings** — `configs/agent-settings.json` → merge into `~/.pi/agent/settings.json` (packages + portable defaults)
- **global context files** — install sources for `~/.pi/agent/AGENTS.md` and `~/.pi/agent/APPEND_SYSTEM.md`

This package is intentionally small. It focuses on a useful core workflow layer for pi, not a giant catalog of framework- or domain-specific packs.

## Quick Start

### Install globally

```bash
npm run install-global
```

This installs into `~/.pi/agent/`, deep-merges managed settings, then runs `pi update --extensions` so packages listed in `configs/agent-settings.json` are installed or updated.

### Or load from the current checkout

```bash
pi -e .
```

Or, in `.pi/settings.json` at the package root:

```json
{
  "extensions": ["."]
}
```

## What gets installed

| Surface | Target |
| --- | --- |
| agents | `~/.pi/agent/agents/hkx/*.md` |
| chains | `~/.pi/agent/chains/hkx-*.chain.json` |
| commands | `~/.pi/agent/commands/` |
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
| `npm run install-global` | Install package surfaces into `~/.pi/agent/` |
| `npm run validate` | Validate package surfaces and frontmatter |
| `npm run mcp:apply-profile` | Apply MCP template profiles |

### Maintenance-only helpers

These are **not** part of the normal install/runtime path and are not exposed as npm scripts.

| Helper | Purpose |
| --- | --- |
| `node scripts/convert-agents-to-pi.mjs` | Bulk-import older agent definitions into the current pi-subagents format. Prefer writing new agents as pi-native from the start. |

## Validation

```bash
npm run validate
```

## Design Principles

- portable pi-native agents and chains
- compact, reusable workflow surfaces
- read-only reviewers and scoped writer agents
- additive MCP configuration instead of heavy installer logic
- optional packs stay out of the core package

## Related Docs

- `docs/README.md` — documentation index and routing guide
- `docs/architecture.md` — package layering and surface boundaries
- `docs/conversion-map.md` — current package surface map
- `docs/skill-routing.md` — primary skill choice when families overlap
- `docs/language-hooks.md` — how language rules and runtime extensions divide responsibility
- `AGENTS.md` — repository maintenance rules
- `GLOBAL_AGENTS.md` — global development handbook source
- `APPEND_SYSTEM.md` — global system-level tool discipline source
