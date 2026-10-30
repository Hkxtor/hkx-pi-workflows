# HKX to Pi Conversion Map

This document describes the **current final shape** of `@hkx/pi-workflows`.

It is not a step-by-step migration log. Treat package metadata, installed surfaces, and current file layout as authoritative.

## Package Identity

- npm package: `@hkx/pi-workflows`
- package runtime name / repo: `hkx-pi-workflows`
- primary target: `pi` / `pi-subagents`
- official package keywords: includes `pi-package`
- git install example: `pi install git:git@github.com:Hkxtor/hkx-pi-workflows`
- global install root (Path B): `~/.pi/agent/`

Note: your local checkout directory name may differ from the package/runtime name. Package metadata and installed surfaces are the source of truth.

## Dual install paths

| Path | How | Loads |
| --- | --- | --- |
| **A** | `pi install git:...` / local package path | `pi.extensions`, `pi.skills`, `pi.prompts` (`commands/`), plus `pi-subagents` agents/chains when pi-subagents is installed |
| **B** | `npm run install-global` | Path A surfaces **plus** rules, the managed global Hookify guard, GLOBAL_AGENTS, APPEND_SYSTEM, MCP, agent-settings/keybindings merge, managed packages update, pi-lsp and permission overlays, rpiv-advisor seed |

Manifest shape (authoritative):

- `package.json` → `pi.{extensions,skills,prompts}`
- `package.json` → `pi-subagents.{agents,chains}`
- Repo directory stays `commands/`; it is **not** renamed to `prompts/`, but is declared as prompts for Path A.

## What the Package Ships

| Surface | Count | In repo | Path A | Path B target |
| --- | ---: | --- | --- | --- |
| agents | 20 | `agents/` | yes (`pi-subagents`) | `~/.pi/agent/agents/hkx/*.md` |
| chains | 16 | `chains/` | yes (`pi-subagents`) | `~/.pi/agent/chains/hkx-*.chain.json` |
| commands / prompts | 58 | `commands/` | yes (`pi.prompts`) | `~/.pi/agent/commands/` and `~/.pi/agent/prompts/` |
| skills | 111 | `skills/` | yes | `~/.pi/agent/skills/` |
| rules | 17 | `rules/` | no (the `hkx-rules` extension ships, the rule files do not) | `~/.pi/agent/rules/` (loaded by `extensions/hkx-rules.ts`) |
| extensions | 7 | `extensions/` | yes | `~/.pi/agent/extensions/` |
| managed global Hookify guard | 1 | `configs/hkx-hookify/hookify.block-unparseable-powershell-control-flow.md` | no | `~/.pi/agent/hookify/` (refresh managed content, preserve `enabled`, backup changed destination) |
| pi-lsp route config | 1 | `configs/pi-lsp/pi-lsp.json` | no | `~/.pi/agent/pi-lsp.json` (after package update; managed primary-language routes) |
| permission config overlay | 1 | `configs/pi-permission-system/config.json` | no | `~/.pi/agent/extensions/pi-permission-system/config.json` (after package update; creates dir if missing) |
| rpiv-advisor config seed | 1 | `configs/rpiv-advisor/advisor.json` | no | seed `~/.config/rpiv-advisor/advisor.json` if missing (never overwrite; no versioned `modelKey`) |
| pi-unipi-notify config seed | 1 | `configs/pi-unipi-notify/config.json` | no | seed `~/.unipi/config/notify/config.json` if missing (never overwrite; copied `0600`, never symlinked; the `/unipi:notify-settings` overlay and `/unipi:notify-event` rewrite it at runtime). Pins native desktop notifications only: the four lifecycle events on, the other five events plus gotify/telegram/recap off, and unanswered-prompt re-notification explicitly off; `ntfy` is a separate `ntfy.json` |
| magic-context config overlay | 1 | `configs/magic-context/magic-context.jsonc` | no | authoritative write to `${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc` (or `~/.config/...`); backup previous destination; `historian` seed-if-missing (template default when absent, operator value preserved); never symlink. Magic Context owns compaction; pi native compaction is disabled in `configs/agent-settings.json`; managed `execute_threshold_tokens` (absolute-token historian trigger) |
| agent settings | 1 | `configs/agent-settings.json` | no | deep-merge into `~/.pi/agent/settings.json` (`packages` + portable defaults); then `pi update --extensions` |
| managed keybindings | 1 | `configs/keybindings.json` | no | merge 11 managed actions into `~/.pi/agent/keybindings.json`; preserve unrelated actions |
| global AGENTS source | 1 | `GLOBAL_AGENTS.md` | no | `~/.pi/agent/AGENTS.md` |
| global system append source | 1 | `APPEND_SYSTEM.md` | no | `~/.pi/agent/APPEND_SYSTEM.md` |
| MCP defaults/templates | several | `.mcp.json`, `mcp-configs/` | no | defaults merge into `~/.pi/agent/mcp.json`; templates/catalog copy to `~/.pi/agent/hkx-pi-workflows/mcp-configs/` |

## Source Provenance Model

This package combines three kinds of inputs:

| Source family | Meaning | How to read it now |
| --- | --- | --- |
| HKX-derived | Adapted from the HKX workflow set | Kept only when the workflow fits pi natively |
| ECC-derived | Adapted from Everything Claude Code / ECC surfaces | Rewritten into pi-native commands, skills, or agents |
| Pi-specific additions | Synthesized specifically for this package | Used where pi needed a new wrapper, chain, or install surface |

The important rule is: **current pi-native behavior matters more than historical origin**.

## Commands

The command set is split into a few stable families.

### Core workflow commands

These are the main operator-facing entry points:

- `workflow`
- `hkx-plan`
- `hkx-plan-prd`
- `blueprint`
- `hkx-plan-canvas`
- `build-fix`
- `code-review`
- `review-pr`
- `refactor-clean`
- `security-scan`
- `test-coverage`
- `quality-gate`
- `update-docs`
- `update-codemaps`
- `checkpoint`
- `aside`

### Hookify guardrail commands

Operator-authored pattern guardrails (ECC hookify → Pi extension):

- `hookify` — create rule from description or conversation analysis (confirm before write)
- `hookify-list` — list project + global rules
- `hookify-configure` — toggle `enabled`
- `hookify-help` — events, format, limits

Runtime: `extensions/hkx-hookify.ts`. Skill: `hookify-rules` (conversation analysis for no-args `/hookify` runs in the main session).  
Project rules: `.pi/hookify.{name}.local.md`. Global: `~/.pi/agent/hookify/`. Kill-switch: `HKX_HOOKIFY=off`.

### Orchestration and loop commands

These coordinate larger workflows or bounded multi-step execution:

- `multi-workflow` — thin ECC `multi-*` router → existing chains / orch / `workflow` (no ccg-workflow runtime)
- `orch-review`
- `orch-add-feature`
- `orch-build-mvp`
- `orch-change-feature`
- `orch-fix-defect`
- `orch-refine-code`
- `loop-start`
- `loop-status`
- `delivery-gate`
- `hkx-session-summary`
- `santa-loop`
- `gan-build` — thin entrance for `gan-style-harness`; owns the iteration loop in-session

### Learning and instinct commands

Session pattern capture and instinct inventory (pending → accept → evolve):

- `learn`
- `learn-eval`
- `evolve`
- `instinct-status`
- `instinct-from-om` — legacy OM session JSONL import
- `instinct-accept`
- `instinct-promote`
- `instinct-export`
- `instinct-import`
- `instinct-decay`
- `instinct-prune`
- `instinct-projects`
- `unified-memory` — memory vault router (`memory recall|save|handoff|promote-instinct|import-ecc|validate` on homunculus)

### PRP operator commands

Thin ECC-derived commit/PR helpers (prompt-only; pair with git + `gh`):

- `prp-commit`
- `prp-pr`

### Package and harness support commands

These support repository maintenance and operator workflows:

- `project-init`
- `recipes`
- `cost-report`
- `skill-create`
- `skill-health`
- `harness-audit`
- `context-budget`

## Skills

The skill catalog is intentionally broad, but it groups into a few clear buckets.

### Engineering workflow skills

Representative examples:

- `tdd-workflow`
- `verification-loop`
- `coding-standards`
- `search-first`
- `iterative-retrieval`
- `intent-driven-development`
- `change-impact`
- `contract-first`
- `parallel-execution-optimizer`
- `delivery-gate`
- `session-summary`
- `santa-method`
- `instinct-evolve`
- `hookify-rules`
- `unified-memory`
- `blueprint`
- `plan-canvas`
- `context-budget`

### Language workflow skills

Representative examples:

- `typescript-workflow`
- `python-workflow`
- `go-workflow`
- `rust-workflow`
- `rust-patterns`
- `rust-testing`
- `bun-runtime`

### Architecture, repo, and harness skills

Representative examples:

- `agent-architecture-audit`
- `agent-harness-construction`
- `agent-introspection-debugging`
- `gan-style-harness`
- `rules-distill`
- `repo-scan`
- `codebase-onboarding`
- `code-tour`
- `architecture-decision-records`
- `project-flow-ops`
- `mcp-server-patterns`

### Research, product, and ops skills

Representative examples:

- `deep-research`
- `market-research`
- `research-ops`
- `product-capability`
- `product-lens`
- `ops-pack`
- `deployment-patterns`
- `kubernetes-patterns`
- `docker-patterns`

In short: the skill layer is the broad guidance layer; the agent layer is the executable specialist layer.

When several skills could match the same ask, use `docs/skill-routing.md` for primary vs secondary routing (research, security, UI, product, config, session quality, and related families).

## Rules

Rules are intentionally smaller and more opinionated than skills.

### Common rules

- `hkx-common-code-review`
- `hkx-common-coding-style`
- `hkx-common-development-workflow`
- `hkx-common-git-workflow`
- `hkx-common-patterns`
- `hkx-common-performance`
- `hkx-common-security`
- `hkx-common-testing`

### Language rules

- `hkx-typescript`
- `hkx-python`
- `hkx-go`
- `hkx-rust`

### Narrow reminder rules

- `hkx-ts-no-console-log`
- `hkx-python-no-bare-except`
- `hkx-rust-no-unwrap`
- `hkx-web-design-quality`
- `hkx-web-performance`

## Agents

The `agents/` directory is now a **pi-subagents native** surface.

### Runtime shape

- frontmatter `package: hkx`
- runtime names: `hkx.<name>`
- explicit acceptance role: `acceptanceRole: read-only` for inspection/planning agents and `acceptanceRole: writer` for mutation agents
- search surface: `ffgrep` / `fffind` (preferred) with native `grep` / `find` as co-resident fallback
- code intelligence surface: `lsp_diagnostics` and `lsp_fix` for configured routes; targeted `ffgrep` and `read` for navigation and structure
- extension providers: any agent declaring an extension tool also declares its provider in `subagentOnlyExtensions` (`npm:@ff-labs/pi-fff` for FFF search, `npm:@narumitw/pi-lsp` for LSP, `npm:pi-web-access` for web tools, `npm:@juicesharp/rpiv-todo` for `todo`), because foreground children never inherit ambient extensions and an unregistered declared tool fails the run
- reviewers are read-only by default
- writer agents use scoped mutation plus supervisor/intercom escalation rules

### Included agents

#### Planning and architecture

Folded in the 2026-10 fold migration (design procedure = main-session process knowledge, see `docs/skill-routing.md`):

- ~~`planner`~~ — folded into `/hkx-plan` (step quality, sizing/phasing, red-flag checklist)
- ~~`architect`~~ — folded into `hexagonal-architecture` / `api-design` skills + `/hkx-plan`
- ~~`code-architect`~~ — folded into `/hkx-plan` + `feature-dev` Phase 4 in-session blueprint
- `code-explorer` — codebase recon: execution paths, dependency maps (kept: context isolation earns its keep)

#### Review and analysis

- `code-reviewer`
- `security-reviewer`
- `pr-test-analyzer`
- `silent-failure-hunter`
- `agent-evaluator`

#### Implementation and cleanup

- `tdd-guide`
- `build-error-resolver` — TypeScript/JavaScript build and type failures
- `python-build-resolver` — Python packaging, import, type, lint, and test-collection failures
- `go-build-resolver`
- `rust-build-resolver`
- `refactor-cleaner` (also covers the former `code-simplifier` readability-polish lane)
- `doc-updater`
- `e2e-runner`

#### Harness configuration

- ~~`harness-optimizer`~~ — folded into `agent-harness-construction` ("Improving an existing harness": baseline scorecard → 1–3 highest-leverage changes → small reversible edits → verify → report before/after). `/harness-audit` stays as the operator entrance.

#### Database work

- ~~`database-reviewer`~~ — folded into `database-migrations` (ordered Review Checklist: migration safety → index coverage → constraints → locks → query plans → tenant isolation). `postgres-patterns` / `redis-patterns` remain the reference lane.

#### Build-quality loop (GAN)

Ported from ECC as the one deliberate multi-subagent exception to the fold-into-main-loop rule: the evaluator must not share context with the generator, otherwise it grades its own reasoning.

- `gan-generator` (writer) — implements `gan/spec.md`, reads `gan/feedback.md`, iterates. Never scores its own work.
- `gan-evaluator` (read-only) — runs the artifact, scores the rubric, returns `pass`/`fail`/`plateau`/`blocked`. Cannot write or edit.

Loop ownership (spec, iteration count, stop decision) stays in the main session per `skills/gan-style-harness`. Planning is folded into the skill — there is no planner agent.

#### Loops

- ~~`loop-operator`~~ — folded into `loop-design-check` Action 3 (checkpoints, stall escalation, operating report). A nested loop inside a child adds a round trip per iteration and hides running state from the only party allowed to judge it; `/loop-start` is already the main-loop shape.

#### Language-specific reviewers

- `typescript-reviewer`
- `python-reviewer`
- `go-reviewer`
- `rust-reviewer`

## Chains

The `chains/` directory is the packaged orchestration layer on top of those agents.

### Review chains

- `hkx-pr-review`
- `hkx-adversarial-review`
- `security-scan`
- `hkx-go-review`
- `hkx-python-review`
- `hkx-rust-review`
- `hkx-typescript-review`

### Build-fix chains

- `hkx-typescript-build-fix`
- `hkx-python-build-fix`
- `hkx-go-build-fix`
- `hkx-rust-build-fix`

### Delivery / implementation chains

- `hkx-feature-flow`
- `hkx-fix-defect`
- `hkx-refactor-flow`
- `hkx-docs-update`
- `hkx-gan-pass` — one generator → evaluator pass; the main loop repeats it via `skills/gan-style-harness`

The three delivery chains fold planning into the implementation step (2026-10 fold migration): the implementation agent drafts a short plan in-step from the explorer's context artifact, instead of a separate mid-chain planner handoff.

Operator entry that **routes** to these chains (and orch commands) without duplicating them: `multi-workflow`.

## Extensions

Seven first-party extensions are shipped intentionally:

- `hkx-rules.ts` — loads `~/.pi/agent/rules/*.md` and injects them into the system prompt: 8 always-on rules as one section (~2,515 tokens), 4 language packs + 2 web rules + 3 edit guardrails activated on first matching file/tool input and delivered once as a message (prompt cache keeps hitting); `/hkx-rules` reports cost, `HKX_RULES=off` disables. Silent when the rules directory is absent (Path A).
- `hkx-language-quality.ts` — low-noise quality guidance / notification surface
- `hkx-gateguard.ts` — destructive-command hard gate; matched Bash commands have no in-session exemption
- `hkx-hookify.ts` — operator Hookify rules (`warn` notify / `block` tool_call); loads `.pi/hookify.*.local.md` + `~/.pi/agent/hookify/`; `HKX_HOOKIFY=off`. Event `bash` means the **shell surface**, which is `powershell` on win32 where pi replaces the native `bash` tool
- `hkx-subagent-supervisor-auto-reply.ts` — parent auto-approves scoped permission/configured-output artifact asks so review chains do not detach
- `hkx-working-indicator.ts` — accent braille working spinner; `/hkx-working-indicator`, `HKX_WORKING_INDICATOR=off`
- `hkx-custom-header.ts` — custom startup header (logo + keybinding hints); `/hkx-custom-header`, `HKX_CUSTOM_HEADER=off`; adapted from amosblomqvist/pi-config

The footer uses pi's native statusline (no third-party chrome package is managed). These first-party files are pi TypeScript extensions, not external shell hook packs.

## Managed global Hookify guard

Path B installs `configs/hkx-hookify/hookify.block-unparseable-powershell-control-flow.md` to `~/.pi/agent/hookify/`. The package refreshes the rule's pattern/body on reinstall, preserves the operator-owned `enabled` flag, backs up changed destinations, and leaves unrelated global rules untouched. Path A does not install this overlay.

This corrects global scope and rule drift; it does not reorder runtime `tool_call` handlers. When `pi-permission-system` loads first, its prompt may still precede Hookify's block.

## External package config overlays

This package can version-control operator config for third-party Pi packages without vendoring their source.

Current overlays:

- `configs/pi-lsp/pi-lsp.json`
  - installed by `npm run install-global` to `~/.pi/agent/pi-lsp.json`
  - install order: after `pi update --extensions`; its explicit map replaces pi-lsp's upstream route catalog
  - routes TypeScript/JavaScript, Python, Rust, and Go when the configured server commands are on `PATH`
- `configs/pi-permission-system/config.json`
  - installed by `npm run install-global` to `~/.pi/agent/extensions/pi-permission-system/config.json`
  - install order: after `pi update --extensions`; creates the extension config directory when missing
- `configs/rpiv-advisor/advisor.json`
  - seeded by `npm run install-global` to `~/.config/rpiv-advisor/advisor.json` (or `$XDG_CONFIG_HOME/...`) **only when missing**
  - portable fields only (`effort`, `guidance`, `disabledForModels`); operators set `modelKey` via `/advisor`
- `configs/pi-tool-display/config.json`
  - seeded by `npm run install-global` to `~/.pi/agent/extensions/pi-tool-display/config.json` **only when missing**
  - the extension's `/tool-display` settings UI rewrites the file at runtime; never overwrite operator choices
- `configs/pi-unipi-notify/config.json`
  - seeded by `npm run install-global` to `~/.unipi/config/notify/config.json` **only when missing**
  - the extension's `/unipi:notify-settings` overlay and `/unipi:notify-event` command rewrite the file at runtime; never overwrite operator choices. Copied rather than symlinked and seeded `0600`, because gotify/telegram credentials land in that file once those platforms are enabled
  - pinned intent: native desktop notifications only — `defaultPlatforms: ["native"]`, `native.suppressWhenFocused: true`, three enabled events (`agent_settled`, `ask_user_prompt`, `permission_request`) with `agent_end` explicitly off (turn-end completion noise stays silent), the remaining five events plus gotify/telegram/recap explicitly off, and `renotify` explicitly disabled (`intervalMs: 120000`, `maxRepeats: 3`). All nine upstream event keys and the full re-notification block are pinned because `loadConfig()` merges the file over the upstream defaults, so an omitted value inherits upstream behavior (three event defaults and re-notification default to on). `ntfy` is absent from this schema — it lives in the separate `~/.unipi/config/notify/ntfy.json` and stays off unless the operator configures it
- `configs/magic-context/magic-context.jsonc`
  - installed by `npm run install-global` to `${XDG_CONFIG_HOME}/cortexkit/magic-context.jsonc` (or `~/.config/cortexkit/...`) as an **authoritative managed overlay**; managed behavior defaults include `execute_threshold_tokens` (absolute-token historian trigger)
  - written on every install (never symlinked); the previous destination is backed up (timestamped `.bak.*` sibling) before the write
  - seed keys (`historian`) are seed-if-missing: the template carries a working default, so a cold install gets a configured historian, and `scripts/install.mjs` writes it only when the destination lacks the key — an existing operator model pick is carried over verbatim, so `npm run install-global` cannot silently undo it; an unreadable or non-object destination fails closed
  - Magic Context owns compaction; pi native `compaction` is disabled in `configs/agent-settings.json`
- `configs/pi-plan-mode/config.json`
  - seeded by `npm run install-global` into `~/.pi/agent/pi-plan-mode.json`, **missing managed keys only**
  - the `/plan` settings UI rewrites the file at runtime, so the operator file is the base and only an absent `defaultPlanTools` / `safeSubcommands` is appended; a fully-seeded file is not rewritten and an unreadable or non-object destination fails closed
  - why: Plan mode's automatic policy admits only tools whose `sourceInfo.source` is `builtin`, and an extension that re-registers a built-in name (pi-tool-display `registerToolOverrides`) rewrites that to its own package, emptying the allowlist. An explicit `defaultPlanTools` list bypasses that filter
  - limits: `safeSubcommands` cannot rescue redirects (`2>/dev/null`), command substitution, or bare globs (quote them); `cd` needs a literal prefix and is deliberately not seeded
  - operator-owned keys stay out of the template: `thinkingLevel`, `toggleShortcut`, `defaultPlanExportPath`, `implementationPlanRetention`, `defaultImplementationModel`, `defaultImplementationThinkingLevel`

## Global agent settings

Portable global settings and the desired pi package list are versioned here:

- source: `configs/agent-settings.json`
- install: deep-merge into `~/.pi/agent/settings.json`
- managed keys: `packages` (authoritative), plus portable defaults such as `compaction` (does **not** set operator theme). When `@cortexkit/pi-magic-context` is in `packages`, Magic Context owns compaction and pi native `compaction.enabled` is `false`; the two halves are validated together in `scripts/validate.mjs`
- not versioned here: machine-local keys (`shellPath`, `defaultProvider`, `defaultModel`, …)
- after merge: `npm run install-global` runs `pi update --extensions`

## Global keybindings

Path B versions a compact editor-keybinding overlay:

- source: `configs/keybindings.json`
- install: managed actions replace their prior values in `~/.pi/agent/keybindings.json`; unrelated operator actions remain
- conflict policy: `Ctrl+Shift+G` stays unclaimed by managed bindings; transcript reverse search remains on `Shift+Enter`
- safety: invalid source or destination JSON fails the keybindings install without rewriting the destination
- active sessions apply changes after `/reload`

## MCP Surfaces

The MCP layer is deliberately simple:

- root `.mcp.json` = Path B source for Pi's built-in MCP (no adapter dependency)
  - `npm run install-global` merges it into `~/.pi/agent/mcp.json`; Path A does not
  - only HTTP `context7` is on by default, with `exposure: "direct"`; native MCP
    connects at session startup; all other servers are opt-in
  - the installer translates only package-owned legacy Context7 defaults;
    the additive merge preserves other operator servers and credentials
    (use `/mcp` to disable legacy entries; migrate adapter-only files separately)
- `mcp-configs/mcp-servers.json` = reference catalog
- `mcp-configs/templates/*.json` = optional additive templates
  - `task-management` adds Shrimp Task Manager only when `MCP_DATA_DIR` is set
- `scripts/apply-mcp-profile.mjs` = day-to-day helper to merge named templates into:
  - project scope: `.pi/mcp.json`
  - user scope: `~/.pi/agent/mcp.json`
  - or an explicit `--target` path

Install also copies `mcp-configs/` and the profile helper under `~/.pi/agent/hkx-pi-workflows/` as reference assets. Applying optional templates remains a separate, explicit step via `npm run mcp:apply-profile`.

This package uses additive MCP templates instead of heavy installer/filter logic.

## Global Context Files

The package deliberately splits repo guidance from global guidance:

- root `AGENTS.md` = repository-maintenance instructions for this package
- `GLOBAL_AGENTS.md` = source for global `~/.pi/agent/AGENTS.md`
- `APPEND_SYSTEM.md` = short system-prompt append for tool discipline

## Intentionally Not Included

These are intentionally left out of the core package unless a user asks for an optional pack:

- framework- or domain-specific reviewer packs
- Claude Code / shell `hooks.json` packs (Hookify is Pi-native via `hkx-hookify` extension + `.pi/` rules — not a Claude hook port)
- external wrapper commands that duplicate pi-native orchestration
- session-history utilities tied to another session store
- Claude Code continuous-learning hooks/observer-loop tied to a different home-directory layout (replaced by optional Pi-native instinct-evolve: `commands/evolve`, `scripts/instinct/`, skill `instinct-evolve`)
- giant language/domain catalogs that would bloat the core package

## Behavior guardrails: Hookify

Pi-native port of ECC hookify (pattern rules, not Claude hooks):

- commands: `hookify`, `hookify-list`, `hookify-configure`, `hookify-help`
- skill: `hookify-rules` (includes the no-args conversation-analysis heuristics + YAML contract)
- extension: `hkx-hookify.ts` (event `bash` = shell surface: `bash` + `powershell`)
- tests: `scripts/tests/hookify-rules.mjs`, `scripts/tests/hookify-install.mjs`
- rules on disk: project `.pi/hookify.{name}.local.md`; global `~/.pi/agent/hookify/`
- Path B managed default: `configs/hkx-hookify/hookify.block-unparseable-powershell-control-flow.md` → global rule directory; managed content is refreshed with backup while the operator's `enabled` value survives
- companion helper: `scripts/shell-command-preflight.mjs` (direct `node` invocation, not an npm script) reports whether a command resolves in `tree-sitter-bash`; an unresolved parse makes pi-permission-system floor the whole command to an `<unparsed-bash-subtree>` prompt that no config rule can suppress, so the highest-value default rule blocks the measured PowerShell shapes: control flow (`if (...) { }`, `foreach/while/for/switch (...) { }`, `do { } while (...)`, `function Name { }`), script-block cmdlets (`ForEach-Object { }`, `Where-Object { }`, `% { }`, `? { }`), `$var.Method(...)` calls, `[Type]::` literals, and the `-join` operator — the rule's message steers the model to block-free simplified syntax (`Where-Object Name -eq 'x'`, `ForEach-Object -MemberName Trim`) or the non-shell file tools
- complements GateGuard (destructive-bash gate) and instinct (cross-session learning); does not replace either

## Optional knowledge surface: Instinct Evolve

Shipped as a thin Pi-native knowledge loop (not a Claude continuous-learning port):

- session extract: `learn`, `learn-eval` (pending instincts; human accept)
- inventory/evolve: `evolve`, `instinct-status`, accept/promote/export/import/decay; legacy session import: `from-om`
- skill: `instinct-evolve`
- CLI: `scripts/instinct/cli.mjs` (Node, Linux + Windows)
- data root: Linux XDG / Windows LocalAppData (`HKX_HOMUNCULUS_DIR` override)
- plan: `docs/instinct-evolve-plan.md`

Still out of scope: bash observer-loop, auto formal skill install, default-on capture.

Operator extras on the same CLI: `prune` (pending TTL cleanup, preview default), `projects` (registry + counts), and `memory` (vault recall/save/handoff/promote-instinct/import-ecc/validate + secret heuristics; skill `unified-memory`, command `/unified-memory`). The legacy JSONL `from-om` import defaults to pending-instinct; opt-in `--to vault|both`. ECC memory import is one-shot read-only (`memory import-ecc`), distinct from instinct `import --from-ecc`.

## Dual-review ship gate: Santa Method

- skill: `santa-method`
- command: `santa-loop`
- related chain: `hkx-adversarial-review` (multi-angle one-shot; Santa adds dual-pass convergence)
- related rule: Delegation Completion Contract in `rules/hkx-common-development-workflow.md` and `GLOBAL_AGENTS.md`

## Multi-session plans: Blueprint + Plan Canvas

- skills: `blueprint`, `plan-canvas`
- commands: `blueprint`, `hkx-plan-canvas`
- CLI: `scripts/plan-canvas.cjs` (`npm run plan-canvas` / bin `hkx-plan-canvas`)
- artifacts: `.pi/plans/*.blueprint.md` / `*.plan.md`
- state: `~/.pi/plan-canvas/` (`HKX_PLAN_CANVAS_*` env)
- Path B also copies the CLI under `~/.pi/agent/hkx-pi-workflows/scripts/`

## Context hygiene: Context Budget

- skill: `context-budget`
- command: `context-budget`
- scans `~/.pi/agent` + package surfaces; no auto-delete

## Naming Rules

- commands use the `hkx-` prefix
- chain files use `hkx-*.chain.json`
- agent runtime names are `hkx.<name>`
- package metadata (`package.json`) is the source of truth for package identity

## Tier 1 ECC skill port — decisions

Reviewed against ECC's 311 skills; only non-overlapping ones with a real gap were ported.

| ECC skill | Decision | Reason |
|---|---|---|
| `change-impact` | ported | no pre-change impact-analysis surface existed |
| `contract-first` | ported | `api-design` covers API shape, not how a boundary evolves |
| `rules-distill` | ported | `rules/` existed with no distillation step |
| `gan-style-harness` | ported (+2 agents, 1 chain, 1 command) | generator/evaluator is the one justified multi-subagent exception |
| `token-budget-advisor` | ported | answer-length control was absent |
| `prompt-caching-strategy` | ported | `cost-aware-llm-pipeline` covers routing, not caching |
| `mcp-dependency-review` | ported | hkx ships `mcp-configs/`; pin review was absent |
| `conventional-commit-review` | ported | the git rule defines the format but nothing drafts a message from a diff |
| `inherit-legacy-style` | ported | `coding-standards` is generic; anti-drift on legacy code was absent |
| `living-docs-governance` | ported | long-lived-doc rot had no owner; `docs-governance` is a router over this and was **not** ported |
| `context-and-decisions` | **not ported** | fully covered by `domain-modeling` (`CONTEXT.md`) + `architecture-decision-records`; the ECC skill itself routes ADRs there |
| `docs-governance` | **not ported** | a router over `living-docs-governance` plus a read-only audit; the audit was folded into that skill instead |
| `module-regression` | **deferred** | the durable `REGRESSION.md` ledger overlaps `change-impact` (per-change discovery) + `verification-loop` (what to run); revisit only if a large multi-module repo needs a persistent ledger |
| `brownfield-retrospective` | **deferred** | 177 lines of process that overlaps the `orch-*` family; high cost, unclear incremental value |
| `i18n-sync` | **not ported** | this pack has no multi-locale surface |
| `spec-miner` | **folded, not added as an agent** | same read-only deep-scan profile as `code-explorer`; became its `mine` mode (Requirements WHEN→THEN / Invariants) instead of a 21st agent |

## How to Use This Map

Use this document to answer:

- what surfaces the package currently ships
- where a workflow belongs (command vs skill vs rule vs agent vs chain)
- which items are stable core surfaces versus intentionally deferred
- what should be installed globally under `~/.pi/agent/`

Use `docs/README.md` as the documentation index, `README.md` for operator-facing install/use instructions, `docs/architecture.md` for layer boundaries and placement decisions, `docs/skill-routing.md` for primary-skill choice when families overlap, `docs/command-agent-map.md` for agent entrance routing, `docs/language-hooks.md` for rule-vs-extension guidance, `docs/classifier-models.md` for classifier / decision model (System One) wiring and `codemode` usage, root `AGENTS.md` for repository maintenance rules, `GLOBAL_AGENTS.md` for the installed global development handbook source, and `APPEND_SYSTEM.md` for the installed global system-level tool discipline source.
