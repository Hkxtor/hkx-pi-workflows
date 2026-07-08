# HKX OMP Workflows

Core Everything Claude Code workflows adapted for Oh My Pi.

This package is intentionally small: it ports the workflow surfaces that map cleanly onto OMP's native extension package model. It does not modify OMP or HKX source trees.

## Load

Run once with an explicit extension package path:

```bash
omp -e ./hkx-omp-workflows
```

Or add the package to an OMP project config, using the path where this package is checked out:

```json
{
  "extensions": ["./hkx-omp-workflows"]
}
```

Place that JSON in `.omp/settings.json` for project-scoped loading.

To install globally into `~/.omp/agent/` (symlink where possible, copy fallback on Windows):

```bash
npm run install-global
```

## Discovery Model

OMP exposes this package differently from Claude Code.

- **Extension-package mode**: when you load `hkx-omp-workflows` via `omp -e ./hkx-omp-workflows` or `.omp/settings.json#extensions`, OMP discovers the package root and automatically scans its sibling `commands/`, `skills/`, `rules/`, `agents/`, and `.mcp.json` surfaces.
- **Global install mode**: when you run `npm run install-global`, this package links or copies its `commands/`, `skills/`, `rules/`, `agents/`, extension modules, and `APPEND_SYSTEM.md` into `~/.omp/agent/`, which is one of OMP's native discovery roots.
- **Skills**: discovered skills are surfaced to the model as metadata in the system prompt, are readable through `skill://<name>`, and can also appear as `/skill:<name>` commands when OMP skill commands are enabled.
- **Agents**: discovered agents become available to the OMP agent runner and task orchestration surfaces without a separate manual copy step.

In short: Claude Code often encourages a directory-by-directory mental model. OMP uses provider-based discovery, so loading the package root or installing into `~/.omp/agent/` is enough.

## Commands

All commands use an `hkx-` prefix to avoid collisions with OMP built-ins.

| Command | Purpose |
|---|---|
| `/hkx-build-fix` | Detect build failures and fix them incrementally |
| `/hkx-checkpoint` | Create, compare, or list lightweight `.omp/checkpoints.log` workflow checkpoints |
| `/hkx-code-review` | Review local changes or a PR without posting externally by default |
| `/hkx-cost-report` | Generate a local cost report from OMP cost-tracking data |
| `/hkx-delivery-gate` | Run manual delivery quality checks before session completion |
| `/hkx-plan` | Produce an implementation plan and wait for confirmation |
| `/hkx-plan-prd` | Draft a lean PRD under `.omp/prds/` |
| `/hkx-project-init` | Propose an OMP project setup plan |
| `/hkx-quality-gate` | Run the repo's validation gates and report status |
| `/hkx-refactor-clean` | Refactor with scoped tests and behavior preservation |
| `/hkx-review-pr` | Orchestrate read-only PR or local diff review across available reviewer agents |
| `/hkx-security-scan` | Scan agent, config, secret, and dependency surfaces |
| `/hkx-skill-create` | Analyze git history to extract patterns and generate SKILL.md files |
| `/hkx-skill-health` | Audit health of all installed skills in the skill portfolio |
| `/hkx-test-coverage` | Identify and close meaningful coverage gaps |
| `/hkx-update-codemaps` | Generate token-lean architecture codemaps from local repo evidence |
| `/hkx-update-docs` | Refresh docs from source-of-truth files while preserving hand-written intent |
| `/hkx-recipes` | Browse or match OMP command-group recipe families by workflow description |
| `/hkx-orch-review` | Multi-dimension adversarial review of local changes or a PR using parallel OMP reviewer agents |
| `/hkx-session-summary` | Generate a concise session-end summary from git log and file change evidence |
| `/hkx-workflow` | Research, plan, implement, verify, and review with OMP-native agents |
| `/hkx-orch-add-feature` | Thin wrapper entrypoint for the net-new feature orchestration workflow |
| `/hkx-orch-build-mvp` | Turn a spec document into a thin-slice MVP orchestration workflow |
| `/hkx-orch-change-feature` | Thin wrapper entrypoint for existing-behavior change orchestration |
| `/hkx-orch-fix-defect` | Thin wrapper entrypoint for bug-fix orchestration with regression-first flow |
| `/hkx-orch-refine-code` | Thin wrapper entrypoint for behavior-preserving refactor orchestration |
| `/hkx-harness-audit` | Audit prompts, skills, commands, MCP, extensions, and safety layers in the local OMP harness |
| `/hkx-loop-start` | Design and stage a managed autonomous loop with explicit stop conditions |
| `/hkx-loop-status` | Inspect loop state from local checkpoints, plans, and progress signals |
| `/hkx-model-route` | Recommend the best OMP model role or service tier for the current task |
## Skills

| Skill | Purpose |
|---|---|
| `hkx-tdd-workflow` | Test-first implementation guidance adapted for OMP |
| `hkx-verification-loop` | Build, lint, test, security, and diff verification |
| `hkx-coding-standards` | Cross-language coding standards |
| `hkx-config-gc` | Garbage collection for OMP config — scan, review, and clean stale or orphaned items |
| `hkx-security-review` | Security review checklist |
| `hkx-frontend-patterns` | React and frontend implementation patterns |
| `hkx-backend-patterns` | API, persistence, and service-layer patterns |
| `hkx-typescript-workflow` | TypeScript and JavaScript development workflow |
| `hkx-python-workflow` | Python implementation, testing, and security workflow |
| `hkx-rust-workflow` | Rust implementation and cargo validation workflow |
| `hkx-go-workflow` | Go implementation and validation workflow |
| `hkx-agent-architecture-audit` | Agent harness architecture audit across prompts, tools, memory, MCP, retries, and rendering |
| `hkx-agent-harness-construction` | Action-space, tool, prompt, observation, and recovery design for OMP agents |
| `hkx-agent-introspection-debugging` | Debugging loops, retry storms, compaction drift, and repeated agent failures |
| `hkx-ai-regression-testing` | Regression testing for agent/provider/tool-call/streaming/sandbox behavior |
| `hkx-bun-runtime` | Bun-first TypeScript runtime, process, file IO, worker, and test guidance |
| `hkx-error-handling` | Robust error contracts across TypeScript, Rust, Python, providers, tools, and TUI rendering |
| `hkx-rust-patterns` | Rust patterns for native crates, FFI, async cancellation, and hot paths |
| `hkx-rust-testing` | Rust and native-binding test patterns for OMP crates |
| `hkx-engineering-pack` | Router for the Engineering Pack skills |
| `hkx-search-first` | Research-before-coding workflow for dependencies, integrations, tools, and abstractions |
| `hkx-iterative-retrieval` | Progressive context retrieval before agent handoff or unfamiliar changes |
| `hkx-intent-driven-development` | Acceptance criteria and risk framing for ambiguous or high-impact requests |
| `hkx-parallel-execution-optimizer` | Dependency-lane planning for safe OMP parallel tool and agent work |
| `hkx-gateguard` | Fact-forcing pre-action gate before risky edits, new files, or commands |
| `hkx-strategic-compact` | Context hygiene guidance for compacting at safe phase boundaries |
| `hkx-api-design` | REST, HTTP, JSON-RPC, webhook, tool-schema, and public API contract design |
| `hkx-api-connector-builder` | Add integrations by matching existing repo connector/provider patterns |
| `hkx-hexagonal-architecture` | Ports-and-adapters boundaries for durable service design and refactors |
| `hkx-database-migrations` | Safe schema, index, backfill, rollback, and zero-downtime migration workflow |
| `hkx-production-audit` | Local-evidence release, deploy, install, and production-readiness audit |
| `hkx-repo-scan` | Local repository inventory, ownership, vendored-code, and refactor-readiness audit |
| `hkx-codebase-onboarding` | Structured repo reconnaissance, architecture map, and onboarding guide workflow |
| `hkx-code-tour` | Reusable CodeTour-style walkthrough artifacts with verified anchors |
| `hkx-architecture-decision-records` | Capture durable architecture decisions as ADRs with context and tradeoffs |
| `hkx-documentation-lookup` | Current library/framework/API documentation lookup through configured MCP docs tools |
| `hkx-e2e-testing` | Browser, CLI, install, smoke, and critical-user-journey E2E testing workflow |
| `hkx-accessibility` | WCAG-oriented UI semantics, keyboard, focus, form, and screen-reader checks |
| `hkx-ops-pack` | Router for operational workflows |
| `hkx-terminal-ops` | Evidence-first local command execution and CI/build debugging |
| `hkx-github-ops` | GitHub issues, PRs, CI checks, releases, and repository automation |
| `hkx-project-flow-ops` | Issue/PR queue triage and execution-flow coordination |
| `hkx-deployment-patterns` | Release, deployment, health check, rollback, and artifact workflows |
| `hkx-docker-patterns` | Dockerfile, Compose, image, network, volume, and health-check patterns |
| `hkx-automation-audit-ops` | Read-only inventory of hooks, CI, scripts, MCP servers, wrappers, and jobs |
| `hkx-workspace-surface-audit` | Workspace repo, plugin, MCP, extension, env, rule, and command surface audit |
| `hkx-canary-watch` | Post-deploy URL, endpoint, asset, console, network, and performance checks |
| `hkx-mcp-server-patterns` | MCP tool/resource/prompt schema, transport, error, security, and ops guidance |
| `hkx-git-workflow` | Branch, commit, PR, conflict, history, and release workflow guidance |
| `hkx-safety-guard` | Guardrails for destructive commands, scoped writes, external mutation, and production work |
| `hkx-security-scan` | OMP config, extension, MCP, command, skill, rule, secret, and permission scan workflow |
| `hkx-benchmark` | Performance measurement, baseline comparison, and regression detection |
| `hkx-deep-research` | Multi-source web research with parallel subagents and cited reports |
| `hkx-exa-search` | Neural search via Exa MCP for web, code, and company research |
| `hkx-market-research` | Competitive analysis, market intelligence, and industry research |
| `hkx-plan-orchestrate` | Multi-step plan decomposition and agent chain design |
| `hkx-research-ops` | Evidence-first current-state research workflow |
| `hkx-delivery-gate` | OMP delivery gating principles — learning artifacts updated, disks safe, no task rationalization |
| `hkx-ecc-recipes` | Map a described OMP workflow to the right hkx- command group with run-order and stop condition |
| `hkx-orch-review` | Multi-agent adversarial review workflow using parallel reviewer agents, dedup, and adversarial verification |
| `hkx-session-summary` | Generate a concise session-end summary from git log and file change evidence |
| `hkx-orch-pipeline` | Shared gated orchestration engine behind the `hkx-orch-*` workflow family |
| `hkx-orch-add-feature` | Net-new feature delivery orchestration: research, plan, TDD, review, and commit gates |
| `hkx-orch-build-mvp` | Turn a design/spec doc into a thin-slice MVP delivery sequence |
| `hkx-orch-change-feature` | Change existing behavior safely with plan, tests, review, and commit gates |
| `hkx-orch-fix-defect` | Bug-fix orchestration built around reproduction, regression tests, and review |
| `hkx-orch-refine-code` | Behavior-preserving refactor orchestration with cleanup and reviewer gates |
| `hkx-loop-design-check` | Goal-deciding safety check for autonomous or recursive agent loops |
| `hkx-agent-self-evaluation` | Structured 5-axis self-evaluation rubric for non-trivial agent output |
| `hkx-browser-qa` | Read-only browser QA using the OMP browser tool for smoke, interaction, and visual checks |
| `hkx-growth-log` | Capture reusable learning patterns after complex work, failures, or reviews |
| `hkx-benchmark-optimization-loop` | Bounded measured optimization loop for repeated performance experiments |
| `hkx-data-throughput-accelerator` | Faster backfills, ETL, export, and table sync with correctness accounting |
| `hkx-latency-critical-systems` | Realtime and hot-path performance workflow for freshness and p95 latency |
| `hkx-recursive-decision-ledger` | Durable ledger for repeated rollouts, recursive search, and marked decisions |
| `hkx-eval-harness` | Eval-driven development framework for agent workflows and regression suites |
| `hkx-council` | Four-voice structured disagreement for ambiguous tradeoff decisions |
| `hkx-product-lens` | Pressure-test product direction before turning it into an implementation contract |
| `hkx-product-capability` | Turn PRD intent into an implementation-ready capability contract |
| `hkx-design-system` | Generate or audit design systems and styling consistency |
| `hkx-frontend-design-direction` | Set a stronger product-specific visual direction for web UI work |
| `hkx-make-interfaces-feel-better` | Polish spacing, typography, motion, and interaction quality in UI work |
| `hkx-postgres-patterns` | PostgreSQL schema, indexing, and query guidance adapted for OMP workflows |
| `hkx-redis-patterns` | Redis caching, data structures, rate limits, and lock patterns |
| `hkx-kubernetes-patterns` | Kubernetes deployment, RBAC, probes, autoscaling, and kubectl debugging |
| `hkx-skill-comply` | Measure whether skills, rules, and agent definitions are actually being followed |
| `hkx-content-hash-cache-pattern` | Path-independent file-processing cache pattern using content hashes |
| `hkx-cost-aware-llm-pipeline` | Budget, routing, retry, and prompt-caching patterns for LLM-backed systems |
| `hkx-regex-vs-llm-structured-text` | Hybrid decision framework for structured-text parsing with deterministic-first extraction |
| `hkx-prompt-optimizer` | Turn a rough request into a stronger OMP-native prompt with explicit scope and validation |
| `hkx-skill-stocktake` | Audit a local OMP skill portfolio for overlap, staleness, and weak discoverability |

This package ports 25 portable reviewer, planning, orchestration, documentation,
build resolver, and architecture agents.

| Agent | Purpose |
|---|---|
| `architect` | System-design and architectural tradeoff specialist for larger structural changes |
| `planner` | Requirement-to-step planning specialist with validation and risk breakdowns |
| `tdd-guide` | Test-first implementation specialist for narrow, behavior-focused changes |
| `refactor-cleaner` | Conservative cleanup and dead-code refactoring specialist |
| `docs-lookup` | Current library and API documentation lookup specialist |
| `e2e-runner` | Critical-journey end-to-end testing specialist |
| `database-reviewer` | PostgreSQL schema, migration, and query-safety specialist |
| `loop-operator` | Bounded autonomous-loop operator with checkpoint and stall controls |
| `harness-optimizer` | OMP harness configuration optimizer for reliability, cost, and throughput |
| `build-error-resolver` | Build and TypeScript error resolution specialist for minimal code changes and quick recovery |
| `code-architect` | Designs feature architectures by analyzing codebase patterns and providing implementation blueprints |
| `code-explorer` | Deeply analyzes codebase features by tracing execution paths, mapping architecture layers, and documenting dependencies |
| `code-reviewer` | General evidence-gated code reviewer for correctness, maintainability, security, performance, and tests |
| `code-simplifier` | Simplifies and refines code for clarity, consistency, and maintainability while preserving behavior |
| `doc-updater` | Documentation and codemap specialist for evidence-backed README, guide, and codemap updates |
| `go-build-resolver` | Go build, vet, linter, and module dependency resolution specialist |
| `go-reviewer` | Expert Go code reviewer specializing in idiomatic patterns, concurrency, error handling, and performance |
| `pr-test-analyzer` | PR test-quality reviewer focused on behavior coverage and regression risk |
| `python-reviewer` | Expert Python code reviewer specializing in PEP 8 compliance, idioms, type hints, security, and performance |
| `rust-build-resolver` | Rust build, compilation, borrow checker, and dependency error resolution specialist |
| `rust-reviewer` | Expert Rust code reviewer specializing in ownership, lifetimes, safety, error handling, and performance |
| `security-reviewer` | Security reviewer for auth, input, data, secrets, dependencies, and trust-boundary changes |
| `silent-failure-hunter` | Reviewer for swallowed errors, dangerous fallbacks, and missing failure propagation |
| `typescript-reviewer` | Expert TypeScript/JavaScript code reviewer specializing in safety, correctness, and patterns |

## Agent Exposure

Agents ship in two supported ways:

- **Extension-package discovery**: load this package with `omp -e ./hkx-omp-workflows` or an `extensions` entry, and OMP will discover `agents/` directly from the package root alongside `skills/` and `commands/`.
- **Native OMP install**: run `npm run install-global`, and the install script will link or copy `agents/*.md` into `~/.omp/agent/agents/` together with the rest of the package surfaces.

You only need a manual `cp` or symlink if you are intentionally bypassing both of those supported loading paths.

## Engineering Pack

The Engineering Pack groups general product-engineering workflows that are useful
across stacks:

`hkx-search-first`, `hkx-iterative-retrieval`,
`hkx-intent-driven-development`, `hkx-parallel-execution-optimizer`,
`hkx-gateguard`, `hkx-strategic-compact`, `hkx-error-handling`,
`hkx-api-design`, `hkx-api-connector-builder`,
`hkx-hexagonal-architecture`, `hkx-database-migrations`,
`hkx-production-audit`, `hkx-repo-scan`, `hkx-codebase-onboarding`,
`hkx-code-tour`, `hkx-architecture-decision-records`,
`hkx-documentation-lookup`, `hkx-e2e-testing`, `hkx-accessibility`,
`hkx-content-hash-cache-pattern`, `hkx-cost-aware-llm-pipeline`, and
`hkx-regex-vs-llm-structured-text`.

Use `hkx-engineering-pack` as a router when the task spans multiple engineering
surfaces.

## Ops Pack

The Ops Pack groups operational workflows:

`hkx-terminal-ops`, `hkx-github-ops`, `hkx-git-workflow`,
`hkx-project-flow-ops`, `hkx-deployment-patterns`, `hkx-docker-patterns`,
`hkx-automation-audit-ops`, `hkx-workspace-surface-audit`,
`hkx-canary-watch`, `hkx-mcp-server-patterns`, `hkx-safety-guard`, and
`hkx-security-scan`.

Use `hkx-ops-pack` for command execution, GitHub/PR/git flow, deployment,
automation, workspace-surface, MCP-server, safety, and security-scan operations.

## Language Rules And Extensions

This package includes common workflow rules, a small language rule pack for TypeScript, Python, Rust, and Go, plus two OMP extensions.

| Surface | Files |
|---|---|
| Common rules | `rules/hkx-common-security.md`, `rules/hkx-common-testing.md`, `rules/hkx-common-coding-style.md`, `rules/hkx-common-code-review.md`, `rules/hkx-common-development-workflow.md`, `rules/hkx-common-git-workflow.md`, `rules/hkx-common-patterns.md`, `rules/hkx-common-performance.md` |
| Language rules | `rules/hkx-typescript.md`, `rules/hkx-python.md`, `rules/hkx-rust.md`, `rules/hkx-go.md` |
| TTSR-style reminders | `rules/hkx-ts-no-console-log.md`, `rules/hkx-rust-no-unwrap.md`, `rules/hkx-python-no-bare-except.md` |
| Web rules | `rules/hkx-web-design-quality.md`, `rules/hkx-web-performance.md` |
| Notify-only extension | `extensions/hkx-language-quality.ts` |
| Pre-action gate extension | `extensions/hkx-gateguard.ts` |

The language-quality extension only notifies. It does not format files, edit files, or run build commands automatically. The gateguard extension blocks first access per file and destructive commands; disable with `HKX_GATEGUARD=off`.

## MCP

OMP loads `.mcp.json` from extension package roots automatically to configure default Model Context Protocol (MCP) servers.

- **Bundled Defaults**: `hkx-omp-workflows` keeps root `.mcp.json` intentionally lean and only auto-loads four default servers: `github`, `context7`, `exa`, and `playwright`.
- **Optional Templates**: `mcp-configs/templates/` now exposes three additive MCP templates: `memory`, `reasoning` (`sequential-thinking`), and `research` (`firecrawl`). Apply them with `npm run mcp:apply-profile -- <name>`, which writes additively to `.omp/mcp.json` by default.
- **Composable Loads**: You can stack templates in one pass, for example `npm run mcp:apply-profile -- memory reasoning`, or target the user-level file with `npm run mcp:apply-profile -- --scope user research`. OMP named profiles are also supported via `npm run mcp:apply-profile -- --scope user --profile deep-research research`.
- **Global Install Asset Path**: `npm run install-global` also installs the catalog and helper script under `~/.omp/agent/hkx-omp-workflows/` as an auxiliary asset directory. OMP does not auto-discover that package root just because it exists under `~/.omp/agent/`; it is there so you can still run the helper and inspect the templates after a global install. Package-root auto-loading still requires `omp -e <path>` or an explicit `extensions` entry.
- **Reference Catalog**: `mcp-configs/mcp-servers.json` remains the broader sanitized catalog of common MCP servers; the shipped templates are thin, named opt-in slices of that catalog.
- **Disabling And Overrides**: Use `.omp/mcp.json` or `~/.omp/agent/mcp.json` for overrides. Use `disabledServers` in the user-level `mcp.json` to suppress discovered servers by name, or define the same server name in project/user `mcp.json` to override a bundled default.

## Validate

```bash
npm run validate
```

The validator checks required files, frontmatter, command naming, and common non-OMP leftovers.

## Conversion Scope

This is a core workflow package, not a full HKX mirror. Deferred surfaces include shell hook packs, session-history utilities, external wrapper commands, and large language-specific skill catalogs. See `docs/conversion-map.md`.

## Analytics

![Alt](https://repobeats.axiom.co/api/embed/30913d54fbca61c5d7b226b31440fad178e2606a.svg "Repobeats analytics image")
