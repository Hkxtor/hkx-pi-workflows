# Repository Agent Guidelines

## Core Identity

You are working in `hkx-pi-workflows` (package `@hkx/pi-workflows`).

This repository maintains a **pi-native workflow package**: portable subagents, chains, commands, skills, rules, extensions, and MCP templates intended for pi / pi-subagents.

## Repository Scope

Included surfaces:

- `agents/` — pi-subagents definitions (`package: hkx`)
- `chains/` — saved pi-subagents chains
- `commands/` — markdown command surfaces for pi discovery
- `skills/` — skill folders
- `rules/` — repo/session rules
- `extensions/` — pi TypeScript extensions
- `configs/` — managed overlays: external extension configs + global agent settings (`agent-settings.json`)
- `GLOBAL_AGENTS.md` — source for global `~/.pi/agent/AGENTS.md`
- `APPEND_SYSTEM.md` — source for global `~/.pi/agent/APPEND_SYSTEM.md`
- `.mcp.json` and `mcp-configs/` — MCP defaults and templates
- `scripts/` — day-to-day package scripts (`install`, `validate`, `mcp:apply-profile`) plus maintenance-only helpers

Keep this package intentionally small. It should stay focused on a useful core workflow set, not become a giant mirror of every possible domain pack.

## Required Workflow

1. Search first. Before adding or replacing any agent, chain, command, skill, rule, extension, helper, or MCP entry, check what already exists.
2. Keep surfaces pi-native. Do not add compatibility shims for unrelated runtimes unless the user explicitly asks.
3. Reuse the package conventions already present instead of introducing a second pattern.
4. Prefer compact workflow guidance over long tutorial text.
5. Verify with `npm run validate` after changing package surfaces or install scripts.
6. Before creating a new surface, check `docs/architecture.md` for layer boundaries, `docs/conversion-map.md` for the current stable package map, and `docs/skill-routing.md` when skill families may overlap.
7. When changing what gets installed globally, also check `scripts/install.mjs`, `README.md`, `configs/agent-settings.json` (if packages/settings change), and the installed target paths under `~/.pi/agent/`.

## Surface Conventions

### Agents

- File basename must match frontmatter `name`.
- Use `package: hkx` so runtime names are `hkx.<name>`.
- Tools must use pi tool names accepted by `scripts/validate.mjs`.
- Reviewers review; resolvers and implementation agents make minimal, scoped edits.
- Prefer `ffgrep` / `fffind` and pi-lens tools over non-pi search aliases.

### Chains

- Chain files live under `chains/` as `hkx-*.chain.json` or `.chain.md`.
- Parallel review steps should stay read-only.
- Implementation chains should keep a single writer agent in the mutation step.

### Commands / Skills / Rules

- Keep guidance concise and operator-friendly.
- Command files keep the `hkx-` prefix.
- Avoid placeholder text and fake workflows.

### Extensions

- Notify-only extensions must not silently mutate project state.
- Gate extensions should stay explicit, low-noise, and actionable.

### External extension configs

- Managed under `configs/<extension-name>/` when this package owns only a config overlay, not the extension package.
- Current: `configs/pi-permission-system/config.json` → `~/.pi/agent/extensions/pi-permission-system/config.json`.
- Install runs after `pi update --extensions` and creates the extension config directory when missing (cold install often leaves no `config.json`).
- Do not vendor third-party extension source into this package unless it becomes a first-party pi extension.

### Global agent settings

- Source: `configs/agent-settings.json`.
- Install deep-merges managed keys into `~/.pi/agent/settings.json` (does not wipe machine-local keys).
- Managed scope: `packages` (authoritative list) plus portable defaults such as `compaction` and `observational-memory`.
- Do **not** version machine-local keys here: `shellPath`, `defaultProvider`, `defaultModel`, `defaultThinkingLevel`, `lastChangelogVersion`.
- After writing settings, `npm run install-global` runs `pi update --extensions` to install/update listed packages, then installs managed extension config overlays.

### Scripts

- Day-to-day npm entry points:
  - `npm run install-global` → `scripts/install.mjs`
  - `npm run validate` → `scripts/validate.mjs`
  - `npm run mcp:apply-profile` → `scripts/apply-mcp-profile.mjs`
- Maintenance-only helpers stay as direct `node scripts/...` invocations and must **not** be promoted into `package.json` scripts unless they become part of the normal operator path.
- `scripts/convert-agents-to-pi.mjs` is a bulk import helper for older agent definitions. Prefer authoring new agents already in the current pi-native format.
- When changing install targets or required package files, update `scripts/install.mjs` and/or `scripts/validate.mjs` together with docs.

### Global context files

- `GLOBAL_AGENTS.md` is the install source for `~/.pi/agent/AGENTS.md` and should stay **generic/global**, not repo-specific.
- Root `AGENTS.md` is for maintaining this repository.
- `APPEND_SYSTEM.md` should stay short and tool-discipline focused.

### Documentation map

- `README.md` is the package homepage and installation guide.
- `docs/README.md` is the documentation index and routing guide.
- `docs/architecture.md` explains layer boundaries and placement decisions.
- `docs/conversion-map.md` is the stable package surface map.
- `docs/skill-routing.md` is the primary-skill router when skill families overlap.
- `docs/language-hooks.md` explains the boundary between language rules and runtime extensions.
- `AGENTS.md` is the repository maintenance rule set.
- `GLOBAL_AGENTS.md` is the source for the installed global development handbook.
- `APPEND_SYSTEM.md` is the source for the installed global system-level tool discipline.

## Quality Bar

- No secrets, credentials, private paths, or user-specific machine assumptions.
- No stale references to removed surfaces or superseded install targets.
- No placeholder workflow text or unvalidated claims.
- README and install behavior should match reality.

## Success Criteria

You are successful when:

- the requested package surface is complete and internally consistent
- `npm run validate` passes
- install behavior matches documentation
- global files under `~/.pi/agent/` come from the intended sources
- the result is smaller, clearer, and more pi-native than the source material it was adapted from
