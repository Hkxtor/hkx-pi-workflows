# Repository Agent Guidelines

## Core Identity

You are working in `hkx-pi-workflows` (package `@hkx/pi-workflows`).

This repository maintains a **pi-native workflow package**: portable subagents, chains, commands, skills, rules, extensions, and MCP templates intended for pi / pi-subagents.

## Repository Scope

Included surfaces:

- `agents/` — pi-subagents definitions (`package: hkx`); declared in `package.json` `pi-subagents.agents`
- `chains/` — saved pi-subagents chains; declared in `package.json` `pi-subagents.chains`
- `commands/` — slash prompt templates on disk; declared as `pi.prompts` (not a native `pi.commands` field)
- `skills/` — skill folders; declared in `pi.skills`
- `rules/` — repo/session rules (Path B / `install-global` only; not a native pi package resource)
- `extensions/` — pi TypeScript extensions; declared in `pi.extensions`
- `configs/` — managed overlays: external extension configs + global agent settings/keybindings (`agent-settings.json`, `keybindings.json`) (Path B only)
- `GLOBAL_AGENTS.md` — source for global `~/.pi/agent/AGENTS.md` (Path B only)
- `APPEND_SYSTEM.md` — source for global `~/.pi/agent/APPEND_SYSTEM.md` (Path B only)
- `.mcp.json` and `mcp-configs/` — MCP defaults and templates (Path B only)
- `scripts/` — day-to-day package scripts (`install`, `validate`, `test`, `mcp:apply-profile`) plus maintenance-only helpers
- `package.json` dual-path manifest: official `pi` resources + `pi-subagents` agents/chains

Keep this package intentionally small. It should stay focused on a useful core workflow set, not become a giant mirror of every possible domain pack.

## Required Workflow

1. Search first. Before adding or replacing any agent, chain, command, skill, rule, extension, helper, or MCP entry, check what already exists.
2. Keep surfaces pi-native. Do not add compatibility shims for unrelated runtimes unless the user explicitly asks.
3. Reuse the package conventions already present instead of introducing a second pattern.
4. Prefer compact workflow guidance over long tutorial text.
5. Verify with `npm run validate` and `npm test` after changing package surfaces, install scripts, or MCP resolver logic.
6. Before creating a new surface, check `docs/architecture.md` for layer boundaries, `docs/conversion-map.md` for the current stable package map, and `docs/skill-routing.md` when skill families may overlap. For model-endpoint or classifier work, also check `docs/classifier-models.md`.
7. When changing what gets installed, also check `package.json` (`pi` / `pi-subagents`), `scripts/install.mjs`, `scripts/validate.mjs`, `README.md` dual-path section, `configs/agent-settings.json` (if packages/settings change), `configs/keybindings.json` (if shortcuts change), and the installed target paths under `~/.pi/agent/`.
8. Keep dual install paths honest: Path A is `pi install` (official package resources only); Path B is `npm run install-global` (full operator overlays). Do not claim Path A installs rules/MCP/GLOBAL_AGENTS.

## Surface Conventions

### Agents

- Surface criterion: an agent earns its own file only when it needs its own context window (heavy use-and-discard reads, parallel fresh-context review) or a scoped tool/writer boundary; process knowledge belongs in skills/commands, and in-chain planning is folded into the implementation step (`docs/skill-routing.md`, fold audit 2026-10).
- File basename must match frontmatter `name`.
- Use `package: hkx` so runtime names are `hkx.<name>`.
- Declare `acceptanceRole: read-only` for inspection/planning agents and `acceptanceRole: writer` for mutation agents; any agent with `edit` or `write` must be a writer.
- Tools must use pi tool names accepted by `scripts/validate.mjs`.
- Reviewers review; resolvers and implementation agents make minimal, scoped edits.
- Prefer `ffgrep` / `fffind` (with native `grep` / `find` as co-resident fallback) and configured pi-lsp diagnostics over non-pi search aliases.
- Every agent that declares an extension tool must also load its provider in `subagentOnlyExtensions` (`npm:@ff-labs/pi-fff`, `npm:@narumitw/pi-lsp`, `npm:pi-web-access`, `npm:@juicesharp/rpiv-todo`). Foreground subagent children never load the parent's ambient extensions, and pi-subagents fails the run when a declared tool is unregistered, so naming the tool alone is not enough; `scripts/validate.mjs` enforces the pairing.

### Chains

- Chain files live under `chains/` as `hkx-*.chain.json` or `.chain.md`.
- Parallel review steps should stay read-only.
- Implementation chains should keep a single writer agent in the mutation step.

### Commands / Skills / Rules

- Keep guidance concise and operator-friendly.
- Command files live under `commands/`. Keep the `hkx-` prefix only for names that would collide with pi native/extension slash commands (`hkx-plan`, `hkx-plan-*`, `hkx-session-summary`); other commands use bare names.
- In `package.json`, map commands as `pi.prompts: ["./commands"]` — never invent `pi.commands`.
- Rules are Path B only for the **files**; do not put `rules` under the official `pi` manifest.
- Rule files become live only through `extensions/hkx-rules.ts` (pi does not read `~/.pi/agent/rules/`). Keep the two halves in sync: a frontmatter shape the loader does not parse silently degrades to nothing.
- Rule frontmatter shapes are contractual (`description` only = always-on; `globs` = path-gated; `condition` + `scope` = edit-gated). Adding a new shape means changing the loader, the tests, and `docs/language-hooks.md` together.
- Keep the always-on set small: every always-on rule is charged to every session (~2,515 tokens for the current 8). Prefer `globs` / `condition` for anything language- or edit-specific.
- Files under `rules/` may carry CRLF line endings; the loader is tolerant, and `scripts/tests/rules-injection.mjs` guards it. Do not "simplify" the parser to `/^---\n/`.
- Retiring a rule, command, prompt, agent, chain, or skill folder must not leave a dangling symlink under `~/.pi/agent/`: `linkOrCopy` only writes what the repo still has. `install.mjs::pruneDanglingLinks` clears them before each linking pass, scoped to symlinks whose link text resolves back into the package source dir and whose target is gone. It never deletes a real file, an operator symlink pointing elsewhere, or a copy-only directory. `scripts/tests/retired-surface-prune.mjs` pins that contract — a dangling rule link otherwise makes `hkx-rules` warn on every session start.
- Avoid placeholder text and fake workflows.

### package.json dual-path contract

- `keywords` must include `pi-package`.
- Pi core packages imported by shipped extensions must be wildcard (`"*"`) `peerDependencies`, never `dependencies`; reject the unrelated npm package named `pi`.
- Official pi resources only: `pi.extensions`, `pi.skills`, `pi.prompts`.
- Do not reintroduce custom brand theme JSON or a `pi.themes` package field.
- Agents/chains: top-level `pi-subagents.agents` / `pi-subagents.chains` (discovered by pi-subagents from installed packages).
- Do not put `agents`, `chains`, `commands`, `rules`, or a custom `pi.name` under `pi` — validate rejects them.
- Path A consumers need `pi-subagents` installed separately for agents/chains.

### Extensions

- Notify-only extensions must not silently mutate project state.
- Gate extensions should stay explicit, low-noise, and actionable.
- Appearance extensions (`hkx-working-indicator`, `hkx-custom-header`) default on with env + slash toggles; they must not write settings or files. Footer uses pi's native statusline; header chrome is first-party via `extensions/hkx-custom-header.ts`.
- `hkx-rules` is the rules loader (`/hkx-rules`, `HKX_RULES`). A missing rules directory is a legitimate state and must stay silent — Path A installs the extension without the rules tree. Promotions are delivered as messages, never by rewriting the system prompt (measured: the `continue` follow-up does not re-enter `before_agent_start`, and rewriting the prompt busts the cache).

### Managed Hookify rules

- `configs/hkx-hookify/hookify.block-unparseable-powershell-control-flow.md` is the Path B source for `~/.pi/agent/hookify/hookify.block-unparseable-powershell-control-flow.md`.
- `npm run install-global` copies it on every install, backs up changed destinations, refreshes package-owned pattern/body content, preserves the operator-owned `enabled` flag, and never removes unrelated global rules.
- Never symlink managed Hookify rules: `/hookify-configure` edits their frontmatter at runtime and must not mutate the checkout. The installer fails closed if the destination is already a symlink or has malformed frontmatter.
- Path A does not install global Hookify rules.

### External extension configs

- Managed under `configs/<extension-name>/` when this package owns only a config overlay, not the extension package.
- Current:
  - `configs/pi-permission-system/config.json` → `~/.pi/agent/extensions/pi-permission-system/config.json` (after `pi update --extensions`; creates dir if missing).
  - `configs/rpiv-advisor/advisor.json` → seed `~/.config/rpiv-advisor/advisor.json` (or `$XDG_CONFIG_HOME/...`) **only if missing** — never overwrite `/advisor` model picks; do not version `modelKey`.
  - `configs/pi-tool-display/config.json` → seed `~/.pi/agent/extensions/pi-tool-display/config.json` **only if missing** — the extension's `/tool-display` settings UI rewrites that file at runtime; never overwrite operator choices.
  - `configs/pi-unipi-notify/config.json` → seed `~/.unipi/config/notify/config.json` **only if missing** — the `/unipi:notify-settings` overlay and `/unipi:notify-event` command rewrite that file at runtime, so never overwrite operator choices; copied (never symlinked) with mode `0600` because gotify/telegram credentials land there. The seed pins native desktop notifications only: `defaultPlatforms: ["native"]`, three enabled events (`agent_settled`, `ask_user_prompt`, `permission_request`) with `agent_end` explicitly off so turn-end completion noise stays silent, the other five events plus gotify/telegram/recap explicitly off, and `renotify` explicitly disabled (`intervalMs: 120000`, `maxRepeats: 3`) so an upstream default cannot add repeated alerts. All nine upstream event keys are enumerated because the extension merges the file over its defaults, so an omitted key would inherit them (three of the nine default to on). `ntfy` is not part of this schema — it lives in the separate `ntfy.json`.
  - `configs/pi-goal/pi-goal.json` → seed `~/.pi/agent/pi-goal.json` **only if missing** — the `/goal` settings UI rewrites that file at runtime, so never overwrite operator choices. The seed pins the documented defaults: `rpc.enabled: false` (the managed-run RPC has no authentication layer) and `continuationLimits` (`automaticTurns: 25`, `noProgressTurns: 3`), so an upstream default flip cannot silently widen automatic work.
  - `configs/magic-context/magic-context.jsonc` → authoritative managed overlay written to `${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc` (or `~/.config/cortexkit/...`) on every install. The previous destination is backed up (timestamped `.bak.*` sibling) before the write; never symlinked (a runtime config symlinked at the repo would let plugin edits mutate the checkout). `historian` is seed-if-missing (mirrors the rpiv-advisor / pi-tool-display precedent): the template carries a working default that a cold install writes, while an existing operator pick is carried over verbatim, so `npm run install-global` cannot silently undo it; an unreadable or non-object destination fails closed. Magic Context owns compaction; pi native `compaction` is disabled in `configs/agent-settings.json`. Behavior defaults such as `execute_threshold_tokens` (absolute-token historian trigger; per-model map) are managed here so the trigger point does not drift across model context windows. Operational gates are pinned too: `fail_closed_blocking: true` (loud recovery error when Magic Context cannot operate — never silent degradation to native compaction) and `allow_home_project: true` (home sessions get their own project identity). Deprecated upstream keys (`protected_tags`, `smart_drops`) stay absent — content-aware supersession reclaim is always on.
  - `configs/pi-plan-mode/config.json` → seed the missing managed keys of `~/.pi/agent/pi-plan-mode.json` (never overwrite; the `/plan` settings UI rewrites that file at runtime, so the operator file is the base and only absent `defaultPlanTools` / `safeSubcommands` are appended; a fully-seeded file is not rewritten, and an unreadable or non-object destination fails closed). The explicit `defaultPlanTools` list is load-bearing, not cosmetic: Pi tool registration is a name-keyed Map, so an extension re-registering a built-in name replaces it and rewrites `sourceInfo.source` from `builtin` to its own package; Plan mode's automatic policy admits only `builtin`-sourced tools (`defaultPlanModeToolNames` → `isBuiltinTool`), so `pi-tool-display` (`registerToolOverrides`) empties the automatic allowlist and Plan mode blocks `read`/`bash`/`grep`/`find`/`ls`. An explicit list takes the `unique(configuredNames)` branch and bypasses that filter. `safeSubcommands` cannot rescue redirects (`2>/dev/null`), command substitution, or bare globs (quote them); `cd` is not in `READ_ONLY_COMMANDS`, so it needs a literal prefix and is deliberately not seeded. Operator-owned keys (`thinkingLevel`, `toggleShortcut`, `defaultPlanExportPath`, `implementationPlanRetention`, `defaultImplementationModel`, `defaultImplementationThinkingLevel`) are never seeded.
- Do not vendor third-party extension source into this package unless it becomes a first-party pi extension.

### Global agent settings

- Source: `configs/agent-settings.json`.
- Install deep-merges managed keys into `~/.pi/agent/settings.json` (does not wipe machine-local keys).
- Managed scope: `packages` (authoritative list), plus portable defaults such as `compaction`, `quietStartup`, and `rewind` (`silentCheckpoints: true`; the managed-run entry point is the session tree and `/fork` branching, so checkpoint footer noise stays off). Do **not** manage operator `theme`.
- Do **not** version machine-local keys here: `shellPath`, `defaultProvider`, `defaultModel`, `defaultThinkingLevel`, `lastChangelogVersion`.
- After writing settings, `npm run install-global` runs `pi update --extensions`, which updates the listed packages that pi has already materialized. That command does not install a package which settings declare but the npm store lacks (`pi update --extensions` is documented as "Update installed packages only") — `pi install npm:<pkg>` is the explicit path for a newly declared package, and cold installs rely on pi's own startup handling. Then it installs the managed global Hookify rule and managed extension config overlays (permission + rpiv-advisor seed + pi-tool-display seed + pi-unipi-notify seed + magic-context authoritative overlay).

### Global keybindings

- Source: `configs/keybindings.json`.
- Path B merges managed actions into `~/.pi/agent/keybindings.json`; managed actions use the package value while unrelated operator actions are preserved.
- Keep `ctrl+shift+g` unclaimed by managed bindings; transcript reverse search remains available through `shift+enter`.
- Reject invalid source or destination JSON rather than replacing an operator file.
- Path A cannot install this overlay; do not add it to the official `pi` manifest.

### Scripts

- Day-to-day npm entry points:
  - `npm run install-global` → `scripts/install.mjs` (Path B full operator install)
  - `npm run validate` → `scripts/validate.mjs` (includes dual-path manifest checks + MCP catalog lint)
  - `npm test` → `scripts/tests/run.mjs` (versioned smoke: merge contract + env-resolver; runner auto-discovers `scripts/tests/*.mjs`)
  - `npm run mcp:apply-profile` → `scripts/apply-mcp-profile.mjs`
- Official package install (Path A) is `pi install git:...` / `pi install npm:...` and does not run `install.mjs`.
- Maintenance-only helpers stay as direct `node scripts/...` invocations and must **not** be promoted into `package.json` scripts unless they become part of the normal operator path.
- `scripts/convert-agents-to-pi.mjs` is a bulk import helper for older agent definitions. Prefer authoring new agents already in the current pi-native format.
- When changing install targets or required package files, update `scripts/install.mjs` and/or `scripts/validate.mjs` together with docs.

### Global context files

- `GLOBAL_AGENTS.md` is the install source for `~/.pi/agent/AGENTS.md` and should stay **generic/global**, not repo-specific.
- Root `AGENTS.md` is for maintaining this repository.
- `APPEND_SYSTEM.md` should stay short and tool-discipline focused.

### Documentation map

- `README.md` is the package homepage and installation guide (English).
- `README.zh-CN.md` is the Chinese operator homepage; keep install facts aligned with `README.md`.
- `docs/README.md` is the documentation index and routing guide.
- `docs/architecture.md` explains layer boundaries and placement decisions.
- `docs/conversion-map.md` is the stable package surface map.
- `docs/skill-routing.md` is the primary-skill router when skill families overlap.
- `docs/language-hooks.md` explains the boundary between language rules and runtime extensions.
- `docs/classifier-models.md` explains classifier / decision model (System One) wiring and `codemode` usage.
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
- `npm run validate` and `npm test` pass
- install behavior matches documentation
- global files under `~/.pi/agent/` come from the intended sources
- the result is smaller, clearer, and more pi-native than the source material it was adapted from
