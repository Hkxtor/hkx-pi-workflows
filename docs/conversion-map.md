# HKX to Pi Conversion Map

This document describes the **current final shape** of `@hkx/pi-workflows`.

It is not a step-by-step migration log. Treat package metadata, installed surfaces, and current file layout as authoritative.

## Package Identity

- npm package: `@hkx/pi-workflows`
- package runtime name: `hkx-pi-workflows`
- primary target: `pi` / `pi-subagents`
- global install root: `~/.pi/agent/`

Note: your local checkout directory name may differ from the package/runtime name. Package metadata and installed surfaces are the source of truth.

## What the Package Ships

| Surface | Count | In repo | Installed target |
| --- | ---: | --- | --- |
| agents | 25 | `agents/` | `~/.pi/agent/agents/hkx/*.md` |
| chains | 15 | `chains/` | `~/.pi/agent/chains/hkx-*.chain.json` |
| commands | 30 | `commands/` | `~/.pi/agent/commands/` |
| skills | 91 | `skills/` | `~/.pi/agent/skills/` |
| rules | 17 | `rules/` | `~/.pi/agent/rules/` |
| extensions | 2 | `extensions/` | `~/.pi/agent/extensions/` |
| permission config overlay | 1 | `configs/pi-permission-system/config.json` | `~/.pi/agent/extensions/pi-permission-system/config.json` (after package update; creates dir if missing) |
| agent settings | 1 | `configs/agent-settings.json` | deep-merge into `~/.pi/agent/settings.json` (`packages` + portable defaults); then `pi update --extensions` |
| global AGENTS source | 1 | `GLOBAL_AGENTS.md` | `~/.pi/agent/AGENTS.md` |
| global system append source | 1 | `APPEND_SYSTEM.md` | `~/.pi/agent/APPEND_SYSTEM.md` |
| MCP defaults/templates | several | `.mcp.json`, `mcp-configs/` | defaults merge into `~/.pi/agent/mcp.json`; templates/catalog copy to `~/.pi/agent/hkx-pi-workflows/mcp-configs/` |

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

- `hkx-workflow`
- `hkx-plan`
- `hkx-plan-prd`
- `hkx-build-fix`
- `hkx-code-review`
- `hkx-review-pr`
- `hkx-refactor-clean`
- `hkx-security-scan`
- `hkx-test-coverage`
- `hkx-quality-gate`
- `hkx-update-docs`
- `hkx-update-codemaps`
- `hkx-checkpoint`

### Orchestration and loop commands

These coordinate larger workflows or bounded multi-step execution:

- `hkx-orch-review`
- `hkx-orch-add-feature`
- `hkx-orch-build-mvp`
- `hkx-orch-change-feature`
- `hkx-orch-fix-defect`
- `hkx-orch-refine-code`
- `hkx-loop-start`
- `hkx-loop-status`
- `hkx-delivery-gate`
- `hkx-session-summary`
- `hkx-model-route`

### Package and harness support commands

These support repository maintenance and operator workflows:

- `hkx-project-init`
- `hkx-recipes`
- `hkx-cost-report`
- `hkx-skill-create`
- `hkx-skill-health`
- `hkx-harness-audit`

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
- `parallel-execution-optimizer`
- `delivery-gate`
- `session-summary`

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
- search surface: `ffgrep` / `fffind`
- code intelligence surface: `lsp_diagnostics`, `lsp_navigation`, `ast_grep_search`, `ast_grep_replace`
- reviewers are read-only by default
- writer agents use scoped mutation plus supervisor/intercom escalation rules

### Included agents

#### Planning and architecture

- `planner`
- `architect`
- `code-architect`
- `code-explorer`

#### Review and analysis

- `code-reviewer`
- `security-reviewer`
- `pr-test-analyzer`
- `silent-failure-hunter`
- `agent-evaluator`
- `docs-lookup`

#### Implementation and cleanup

- `tdd-guide`
- `build-error-resolver`
- `go-build-resolver`
- `rust-build-resolver`
- `code-simplifier`
- `refactor-cleaner`
- `doc-updater`
- `database-reviewer`
- `e2e-runner`
- `harness-optimizer`
- `loop-operator`

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
- `hkx-security-scan`
- `hkx-go-review`
- `hkx-python-review`
- `hkx-rust-review`

### Build-fix chains

- `hkx-build-fix`
- `hkx-typescript-build-fix`
- `hkx-python-build-fix`
- `hkx-go-build-fix`
- `hkx-rust-build-fix`

### Delivery / implementation chains

- `hkx-feature-flow`
- `hkx-fix-defect`
- `hkx-refactor-flow`
- `hkx-docs-update`

## Extensions

Two extensions are shipped intentionally:

- `hkx-language-quality.ts` — low-noise quality guidance / notification surface
- `hkx-gateguard.ts` — pre-edit / destructive-action gatekeeping surface

These are pi TypeScript extensions, not external shell hook packs.

## External extension config overlays

This package can version-control operator config for third-party extensions without vendoring their source.

Current overlay:

- `configs/pi-permission-system/config.json`
- installed by `npm run install-global` to `~/.pi/agent/extensions/pi-permission-system/config.json`
- install order: after `pi update --extensions`; creates the extension config directory when missing

## Global agent settings

Portable global settings and the desired pi package list are versioned here:

- source: `configs/agent-settings.json`
- install: deep-merge into `~/.pi/agent/settings.json`
- managed keys: `packages` (authoritative), plus portable defaults such as `compaction` and `observational-memory`
- not versioned here: machine-local keys (`shellPath`, `defaultProvider`, `defaultModel`, …)
- after merge: `npm run install-global` runs `pi update --extensions`

## MCP Surfaces

The MCP layer is deliberately simple:

- root `.mcp.json` = default package MCP surface
  - `npm run install-global` merges it into `~/.pi/agent/mcp.json`
- `mcp-configs/mcp-servers.json` = reference catalog
- `mcp-configs/templates/*.json` = optional additive templates
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
- shell hook packs and hookify flows
- external wrapper commands that duplicate pi-native orchestration
- session-history utilities tied to another session store
- continuous-learning scripts tied to a different home-directory layout
- giant language/domain catalogs that would bloat the core package

## Naming Rules

- commands use the `hkx-` prefix
- chain files use `hkx-*.chain.json`
- agent runtime names are `hkx.<name>`
- package metadata (`package.json`) is the source of truth for package identity

## How to Use This Map

Use this document to answer:

- what surfaces the package currently ships
- where a workflow belongs (command vs skill vs rule vs agent vs chain)
- which items are stable core surfaces versus intentionally deferred
- what should be installed globally under `~/.pi/agent/`

Use `docs/README.md` as the documentation index, `README.md` for operator-facing install/use instructions, `docs/architecture.md` for layer boundaries and placement decisions, `docs/skill-routing.md` for primary-skill choice when families overlap, `docs/language-hooks.md` for rule-vs-extension guidance, root `AGENTS.md` for repository maintenance rules, `GLOBAL_AGENTS.md` for the installed global development handbook source, and `APPEND_SYSTEM.md` for the installed global system-level tool discipline source.
