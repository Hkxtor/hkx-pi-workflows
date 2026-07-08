# HKX To OMP Conversion Map

This package ports a small, useful slice of HKX into an OMP-native extension package.

## Ported Commands

| HKX Source | OMP Command | Notes |
|---|---|---|
| `HKX/commands/multi-workflow.md` | `commands/hkx-workflow.md` | Replaced external wrapper orchestration with OMP-native `eval`, `agent`, and `parallel` guidance |
| `HKX/commands/plan.md` | `commands/hkx-plan.md` | Uses `.omp/plans/` and avoids conflict with OMP built-in `/plan` |
| `HKX/commands/plan-prd.md` | `commands/hkx-plan-prd.md` | Uses `.omp/prds/` |
| `HKX/commands/build-fix.md` | `commands/hkx-build-fix.md` | Adds OMP-specific validation notes |
| `HKX/commands/code-review.md` | `commands/hkx-code-review.md` | Read-only by default, OMP guidance paths |
| `HKX/commands/review-pr.md` | `commands/hkx-review-pr.md` | OMP-native read-only PR or local diff review orchestration across available reviewer agents |
| `HKX/commands/update-codemaps.md` | `commands/hkx-update-codemaps.md` | Generates token-lean `docs/CODEMAPS/` architecture maps from local OMP repo evidence |
| `HKX/commands/update-docs.md` | `commands/hkx-update-docs.md` | Refreshes docs from source-of-truth files while preserving manual sections |
| `HKX/commands/checkpoint.md` | `commands/hkx-checkpoint.md` | Uses `.omp/checkpoints.log` for lightweight workflow state; no automatic stash, commit, push, or branch mutation |
| `HKX/commands/quality-gate.md` | `commands/hkx-quality-gate.md` | Generalized to OMP validation gates |
| `HKX/commands/security-scan.md` | `commands/hkx-security-scan.md` | Focused on OMP config and extension package surfaces |
| `HKX/commands/refactor-clean.md` | `commands/hkx-refactor-clean.md` | Behavior-preserving refactor workflow |
| `HKX/commands/test-coverage.md` | `commands/hkx-test-coverage.md` | Contract-driven test coverage |
| `HKX/commands/project-init.md` | `commands/hkx-project-init.md` | Dry-run OMP project initialization |
| `ECC/commands/cost-report.md` | `commands/hkx-cost-report.md` | Adapted from ECC cost-tracker: uses OMP path guidance instead of a hardcoded metrics path |
| `ECC/commands/skill-create.md` | `commands/hkx-skill-create.md` | Adapted to OMP: removed GitHub App integration, uses `Bash` for `git log` instead of ECC scripts path |
| `ECC/commands/skill-health.md` | `commands/hkx-skill-health.md` | Adapted to OMP: replaced ECC bash script with `grep`/`glob`/`read` tool-based audit; removed `--json` and `--panel` options |
| `ECC/skills/ecc-recipes/SKILL.md` | `commands/hkx-recipes.md` | Advisory workflow recipe mapper: live-reads command directory, classifies into families by prefix, outputs run-order and stop condition. OMP-native `glob`/`read` instead of ECC bash-based command discovery |
| `ECC/workflows/orch-review.workflow.js` | `commands/hkx-orch-review.md` | Multi-dimension adversarial review: parallel reviewer agents, dedup, adversarial verify of CRITICAL/HIGH. Uses OMP `task` for parallel review agents instead of ECC native Workflow tool |
| `ECC/.kiro/hooks/session-summary.kiro.hook` | `commands/hkx-session-summary.md` | Session-end summary via `eval` and LLM completion, with optional persistence to `.omp/session-summary.log` |
| `ECC/skills/delivery-gate/SKILL.md` | `commands/hkx-delivery-gate.md` | Pre-completion quality gate: OMP-native manual checklist using `bash` (disk, git) and `glob`/`grep` (learning artifacts, rationalization heuristics) |
| `ECC/commands/orch-add-feature.md` | `commands/hkx-orch-add-feature.md` | Thin OMP wrapper over `hkx-orch-add-feature`; preserves gated orchestration while aligning names and OMP command paths |
| `ECC/commands/orch-build-mvp.md` | `commands/hkx-orch-build-mvp.md` | Thin OMP wrapper over `hkx-orch-build-mvp`; removed ECC GAN-harness assumptions and aligned to `.omp/prds/` / OMP slice workflow |
| `ECC/commands/orch-change-feature.md` | `commands/hkx-orch-change-feature.md` | Thin OMP wrapper over `hkx-orch-change-feature`; keeps changed-tests-first semantics and OMP gate wording |
| `ECC/commands/orch-fix-defect.md` | `commands/hkx-orch-fix-defect.md` | Thin OMP wrapper over `hkx-orch-fix-defect`; keeps regression-first bug-fix flow and OMP build-fix references |
| `ECC/commands/orch-refine-code.md` | `commands/hkx-orch-refine-code.md` | Thin OMP wrapper over `hkx-orch-refine-code`; keeps behavior-preserving refactor gates with OMP reviewer references |
| `ECC/commands/harness-audit.md` | `commands/hkx-harness-audit.md` | Reinterpreted for OMP: deterministic ECC script dependency removed; now audits prompts, skills, commands, MCP, extensions, and safety surfaces via OMP-native evidence |
| `ECC/commands/loop-start.md` | `commands/hkx-loop-start.md` | Rewritten for OMP: removed Claude hook/profile assumptions and converted to OMP loop design + staging workflow using `hkx-loop-design-check` and `loop-operator` |
| `ECC/commands/loop-status.md` | `commands/hkx-loop-status.md` | Rewritten for OMP: removed Claude transcript scanning and ECC CLI dependency; now inspects `.omp/checkpoints.log`, plans, and local progress signals |
| `ECC/commands/model-route.md` | `commands/hkx-model-route.md` | Rewritten for OMP model roles (`smol`/`default`/`slow`/`plan`) and `/fast` service-tier guidance instead of Claude model naming |

## Ported Skills

| HKX Source | OMP Skill | Notes |
|---|---|---|
| `HKX/skills/tdd-workflow/SKILL.md` | `skills/tdd-workflow/SKILL.md` | Adapted to OMP validation; synced plan handoff safety checklist and TDD evidence report from ECC (2026-06-15); synced Step 0 test-runner detection (`<test>`/`<coverage>`/`<lint>` placeholders, Bun native pattern) from ECC #2347 (2026-06-30), using OMP `read`/`bash` instead of ECC's package-manager script |
| `HKX/skills/verification-loop/SKILL.md` | `skills/verification-loop/SKILL.md` | OMP-oriented gate report |
| `HKX/skills/coding-standards/SKILL.md` | `skills/coding-standards/SKILL.md` | Cross-language standards |
| `HKX/skills/security-review/SKILL.md` | `skills/security-review/SKILL.md` | Agent and config security included |
| `HKX/skills/frontend-patterns/SKILL.md` | `skills/frontend-patterns/SKILL.md` | UI and accessibility guidance |
| `HKX/skills/backend-patterns/SKILL.md` | `skills/backend-patterns/SKILL.md` | API, persistence, and service patterns |
| Language rules and workflow guidance | `skills/typescript-workflow/SKILL.md` | OMP-oriented TypeScript and JavaScript workflow |
| Language rules and workflow guidance | `skills/python-workflow/SKILL.md` | OMP-oriented Python workflow |
| Language rules and workflow guidance | `skills/rust-workflow/SKILL.md` | OMP-oriented Rust workflow |
| Language rules and workflow guidance | `skills/go-workflow/SKILL.md` | OMP-oriented Go workflow |
| `HKX/skills/agent-architecture-audit/SKILL.md` | `skills/agent-architecture-audit/SKILL.md` | Adapted to OMP's prompt, tool, memory, MCP, retry, compaction, rendering, auth, and persistence layers |
| `HKX/skills/agent-harness-construction/SKILL.md` | `skills/agent-harness-construction/SKILL.md` | Adapted to OMP capability surfaces: skills, commands, rules, tools, extensions, and MCP |
| `HKX/skills/agent-introspection-debugging/SKILL.md` | `skills/agent-introspection-debugging/SKILL.md` | Adapted for OMP loop, retry, compaction, worktree, and tool-observation failures |
| `HKX/skills/ai-regression-testing/SKILL.md` | `skills/ai-regression-testing/SKILL.md` | Adapted to OMP mock providers, streaming, tool-call, sandbox, and fallback contracts |
| `HKX/skills/bun-runtime/SKILL.md` | `skills/bun-runtime/SKILL.md` | Adapted to OMP Bun-first TypeScript rules and worker/build conventions |
| `HKX/skills/error-handling/SKILL.md` | `skills/error-handling/SKILL.md` | Adapted to OMP tool, provider, retry, auth, and TUI error contracts |
| `HKX/skills/rust-patterns/SKILL.md` | `skills/rust-patterns/SKILL.md` | Adapted to OMP native crates, FFI boundaries, async cancellation, and workspace lints |
| `HKX/skills/rust-testing/SKILL.md` | `skills/rust-testing/SKILL.md` | Adapted to OMP Rust/native binding verification paths |
| Engineering Pack router | `skills/engineering-pack/SKILL.md` | New OMP router skill for the engineering pack |
| `HKX/skills/search-first/SKILL.md` | `skills/search-first/SKILL.md` | Adapted to OMP local-first research, dependency, MCP, extension, and package-manager decisions |
| `HKX/skills/iterative-retrieval/SKILL.md` | `skills/iterative-retrieval/SKILL.md` | Adapted to OMP `find`/`search`/`read` context refinement before agent handoff |
| `HKX/skills/intent-driven-development/SKILL.md` | `skills/intent-driven-development/SKILL.md` | Adapted to OMP acceptance criteria and risk gating before high-impact changes |
| `HKX/skills/parallel-execution-optimizer/SKILL.md` | `skills/parallel-execution-optimizer/SKILL.md` | Adapted to OMP batched tool calls, `task` agents, lane isolation, and final synthesis |
| `HKX/skills/gateguard/SKILL.md` | `skills/gateguard/SKILL.md` | Converted from hook/package setup into OMP fact-forcing operator guidance; synced evidence, denial-limit stability, and anti-patterns from ECC (2026-06-11) |
| `HKX/skills/strategic-compact/SKILL.md` | `skills/strategic-compact/SKILL.md` | Converted from hook setup into OMP phase-boundary context hygiene; synced context-size signal, what-survives-compaction table from ECC (2026-06-11) |
| `HKX/skills/api-design/SKILL.md` | `skills/api-design/SKILL.md` | Expanded beyond REST to OMP tool APIs, JSON-RPC, webhooks, and public package contracts |
| `HKX/skills/api-connector-builder/SKILL.md` | `skills/api-connector-builder/SKILL.md` | Adapted to OMP local-first connector/provider discovery and wiring |
| `HKX/skills/hexagonal-architecture/SKILL.md` | `skills/hexagonal-architecture/SKILL.md` | Adapted to OMP TypeScript/Rust/Python/Go service boundaries and refactors |
| `HKX/skills/database-migrations/SKILL.md` | `skills/database-migrations/SKILL.md` | Adapted to local migration evidence, expand-contract workflow, and ORM/tool-agnostic safety checks |
| `HKX/skills/production-audit/SKILL.md` | `skills/production-audit/SKILL.md` | Adapted to OMP release, install, CI, native artifact, deploy, and launch-readiness surfaces |
| `HKX/skills/repo-scan/SKILL.md` | `skills/repo-scan/SKILL.md` | Converted from external scanner install guidance to local-evidence repo inventory and ownership audit |
| `HKX/skills/codebase-onboarding/SKILL.md` | `skills/codebase-onboarding/SKILL.md` | Adapted to OMP read/find/search, project guidance, and compact onboarding output |
| `HKX/skills/code-tour/SKILL.md` | `skills/code-tour/SKILL.md` | Adapted to CodeTour-style `.tour` artifacts with verified OMP `read` anchors |
| `HKX/skills/architecture-decision-records/SKILL.md` | `skills/architecture-decision-records/SKILL.md` | Adapted to OMP-safe ADR creation with explicit approval before writes |
| `HKX/skills/documentation-lookup/SKILL.md` | `skills/documentation-lookup/SKILL.md` | Adapted to configured Context7-style MCP documentation tools |
| `HKX/skills/e2e-testing/SKILL.md` | `skills/e2e-testing/SKILL.md` | Adapted to OMP browser, CLI, install, smoke, and critical-flow testing |
| `HKX/skills/accessibility/SKILL.md` | `skills/accessibility/SKILL.md` | Adapted to OMP UI, dashboard, keyboard, focus, form, and WCAG checks |
| Ops Pack router | `skills/ops-pack/SKILL.md` | New OMP router skill for operational workflows |
| `HKX/skills/terminal-ops/SKILL.md` | `skills/terminal-ops/SKILL.md` | Adapted to OMP evidence-first command execution |
| `HKX/skills/github-ops/SKILL.md` | `skills/github-ops/SKILL.md` | Adapted to read-first GitHub issue, PR, CI, and release workflows |
| `HKX/skills/project-flow-ops/SKILL.md` | `skills/project-flow-ops/SKILL.md` | Adapted to OMP repo issue/PR flow triage |
| `HKX/skills/deployment-patterns/SKILL.md` | `skills/deployment-patterns/SKILL.md` | Adapted to OMP deployment, release, rollback, and health evidence |
| `HKX/skills/docker-patterns/SKILL.md` | `skills/docker-patterns/SKILL.md` | Adapted to OMP Dockerfile and Compose operations |
| `HKX/skills/automation-audit-ops/SKILL.md` | `skills/automation-audit-ops/SKILL.md` | Adapted to OMP hooks, scripts, CI, MCP, extensions, and wrappers |
| `HKX/skills/workspace-surface-audit/SKILL.md` | `skills/workspace-surface-audit/SKILL.md` | Adapted to OMP repo, plugin, MCP, extension, env, command, skill, and rule surfaces |
| `HKX/skills/canary-watch/SKILL.md` | `skills/canary-watch/SKILL.md` | Adapted to OMP post-deploy URL and endpoint canary checks |
| `HKX/skills/mcp-server-patterns/SKILL.md` | `skills/mcp-server-patterns/SKILL.md` | Adapted to OMP MCP server design and operational review |
| `HKX/skills/git-workflow/SKILL.md` | `skills/git-workflow/SKILL.md` | Adapted to safe local git evidence, conventional commits, PRs, conflict handling, and releases |
| `HKX/skills/safety-guard/SKILL.md` | `skills/safety-guard/SKILL.md` | Adapted from hook-based blocking into OMP operator guardrails and approval gates |
| `HKX/skills/security-scan/SKILL.md` | `skills/security-scan/SKILL.md` | Adapted from Claude config scanning to OMP config, extension, MCP, command, rule, and secret surfaces |
| `HKX/skills/orch-pipeline/SKILL.md` | `skills/orch-pipeline/SKILL.md` | Shared orchestration engine adapted to OMP agents (`planner`, `tdd-guide`, `code-reviewer`, `security-reviewer`), commands (`/hkx-build-fix`, `/hkx-code-review`), and tools (`find`/`search`/`read` for research) |
| `HKX/skills/orch-add-feature/SKILL.md` | `skills/orch-add-feature/SKILL.md` | Feature orchestration wrapper adapted to OMP agent and command references |
| `HKX/skills/orch-build-mvp/SKILL.md` | `skills/orch-build-mvp/SKILL.md` | MVP bootstrap wrapper adapted to OMP `.omp/prds/` spec paths and vertical-slice workflow |
| `HKX/skills/orch-change-feature/SKILL.md` | `skills/orch-change-feature/SKILL.md` | Behavior-change wrapper adapted to OMP agent and command references |
| `HKX/skills/orch-fix-defect/SKILL.md` | `skills/orch-fix-defect/SKILL.md` | Bug-fix wrapper adapted to OMP agent and command references |
| `HKX/skills/orch-refine-code/SKILL.md` | `skills/orch-refine-code/SKILL.md` | Refactor wrapper adapted to OMP `refactor-cleaner` agent and command references |
| `ECC/skills/config-gc/SKILL.md` | `skills/config-gc/SKILL.md` | Adapted to OMP config paths (`.omp/`, `~/.omp/`), OMP tooling (`find`/`search`/`read`), and OMP-specific scan channels (commands, rules, extensions) |
| `ECC/skills/benchmark/SKILL.md` | `skills/benchmark/SKILL.md` | Adapted to OMP browser/bash tools, `.omp/benchmarks/` storage, and OMP skill references (`hkx-canary-watch`, `hkx-web-performance`) |
| `ECC/skills/research-ops/SKILL.md` | `skills/research-ops/SKILL.md` | Adapted to OMP skill references (`hkx-exa-search`, `hkx-deep-research`); deferred `lead-intelligence` and `knowledge-ops` |
| `ECC/skills/deep-research/SKILL.md` | `skills/deep-research/SKILL.md` | Adapted to OMP `task` tool for parallel subagents, `read` for URL fetching, `web_search` fallback |
| `ECC/skills/market-research/SKILL.md` | `skills/market-research/SKILL.md` | Adapted to OMP tools (`web_search`, `read`, `task`) and related skill references |
| `ECC/skills/exa-search/SKILL.md` | `skills/exa-search/SKILL.md` | Adapted to OMP `.mcp.json` / `~/.omp/.mcp.json` config paths; added `web_search` fallback |
| `ECC/skills/plan-orchestrate/SKILL.md` | `skills/plan-orchestrate/SKILL.md` | Adapted to OMP `task`/`parallel` invocation shape; removed ECC install form detection; aligned agent catalogue with OMP agents |
| `ECC/skills/loop-design-check/SKILL.md` | `skills/loop-design-check/SKILL.md` | Adapted to OMP: goal-decidability and runaway-prevention for agent loops; references `parallel-execution-optimizer`/`agent-introspection-debugging` for mechanism layer; removed ECC autonomous-loops cross-refs (not ported) |
| `ECC/skills/growth-log/SKILL.md` | `skills/growth-log/SKILL.md` | Adapted to OMP: learning-pattern capture methodology; replaced ECC `delivery-gate` Stop hook description with OMP session-end verification framing (reminder rule or manual beat, not a harness hook) |
| `ECC/skills/browser-qa/SKILL.md` | `skills/browser-qa/SKILL.md` | Adapted to OMP `browser` tool (tab.observe/screenshot/evaluate/ariaSnapshot), read-only-first blast radius, baseline-or-die, honest a11y scope; pairs with `hkx-canary-watch` and `hkx-accessibility` |
| `ECC/skills/delivery-gate/SKILL.md` | `skills/delivery-gate/SKILL.md` | Adapted to OMP: removed Python Stop hook, replaced with session-end gating guidance using OMP `eval`/`bash` checks for disk space, learning artifact staleness, and rationalization heuristics |
| `ECC/skills/ecc-recipes/SKILL.md` | `skills/ecc-recipes/SKILL.md` | Adapted to OMP: replaced ECC bash-based command discovery with OMP `glob`/`read` live reads; family classification maps hkx- prefix families instead of ECC command families |
| `ECC/workflows/orch-review.workflow.js` | `skills/orch-review/SKILL.md` | Adapted to OMP: multi-agent adversarial review using OMP `task` and reviewer agents (`code-reviewer`, `<language>-reviewer`, `security-reviewer`) instead of ECC Workflow tool; dedup and adversarial verify pattern preserved |
| `ECC/.kiro/hooks/session-summary.kiro.hook` | `skills/session-summary/SKILL.md` | Adapted to OMP: Kiro agentStop hook converted to explicit command + skill using `eval`/`completion` and optional `.omp/session-summary.log` persistence |
| `ECC/skills/kubernetes-patterns/SKILL.md` | `skills/kubernetes-patterns/SKILL.md` | Adapted to OMP ops-pack; cross-language infrastructure skill paired with `hkx-docker-patterns`/`hkx-deployment-patterns`; kubectl and YAML content unchanged |
| `ECC/skills/agent-self-evaluation/SKILL.md` | `skills/agent-self-evaluation/SKILL.md` | OMP adaptation: 5-axis self-evaluation rubric and report template; removed `templates/evaluation-report.md` and `references/hook-integration.md` external refs (template inlined); Stop hook trigger generalized to OMP session-end beat; `agent-eval` related-skill ref replaced with OMP `ai-regression-testing`; pairs with `agent-evaluator` agent |
| `ECC/skills/council/SKILL.md` | `skills/council/SKILL.md` | Adapted to OMP: structured four-voice decision workflow kept, references aligned to OMP planner/architect agents |
| `ECC/skills/data-throughput-accelerator/SKILL.md` | `skills/data-throughput-accelerator/SKILL.md` | Adapted to OMP: normalized naming, kept throughput/accounting workflow, and added OMP `.omp/` artifact-path guidance |
| `ECC/skills/design-system/SKILL.md` | `skills/design-system/SKILL.md` | Adapted to OMP frontend workflow references and package naming |
| `ECC/skills/eval-harness/SKILL.md` | `skills/eval-harness/SKILL.md` | Adapted to OMP agent-session and eval-driven workflow language |
| `ECC/skills/frontend-design-direction/SKILL.md` | `skills/frontend-design-direction/SKILL.md` | Adapted to OMP UI-workflow references and naming |
| `ECC/skills/make-interfaces-feel-better/SKILL.md` | `skills/make-interfaces-feel-better/SKILL.md` | Adapted to OMP UI-polish workflow references and naming |
| `ECC/skills/postgres-patterns/SKILL.md` | `skills/postgres-patterns/SKILL.md` | Adapted to OMP database workflow references; pairs with `database-reviewer` and `hkx-database-migrations` |
| `ECC/skills/product-capability/SKILL.md` | `skills/product-capability/SKILL.md` | Adapted to OMP PRD-to-capability workflow and `.omp/` artifact expectations |
| `ECC/skills/product-lens/SKILL.md` | `skills/product-lens/SKILL.md` | Adapted to OMP product-diagnostic workflow and related-skill references |
| `ECC/skills/redis-patterns/SKILL.md` | `skills/redis-patterns/SKILL.md` | Adapted to OMP compact infrastructure guidance and package naming |
| `ECC/skills/skill-comply/SKILL.md` | `skills/skill-comply/SKILL.md` | Adapted to OMP skills/rules/agents compliance measurement language |
| `ECC/skills/benchmark-optimization-loop/SKILL.md` | `skills/benchmark-optimization-loop/SKILL.md` | Adapted to OMP: bounded optimization loop with `.omp/benchmarks/` ledger guidance and related-skill links |
| `ECC/skills/latency-critical-systems/SKILL.md` | `skills/latency-critical-systems/SKILL.md` | Adapted to OMP: hot-path latency workflow with browser/canary validation references and OMP artifact guidance |
| `ECC/skills/recursive-decision-ledger/SKILL.md` | `skills/recursive-decision-ledger/SKILL.md` | Adapted to OMP: recursive rollout ledger with `.omp/ledgers/` default path and OMP safety framing |
| `ECC/skills/content-hash-cache-pattern/SKILL.md` | `skills/content-hash-cache-pattern/SKILL.md` | Adapted to OMP: compact service-layer cache pattern with OMP-friendly file-processing and benchmark references |
| `ECC/skills/cost-aware-llm-pipeline/SKILL.md` | `skills/cost-aware-llm-pipeline/SKILL.md` | Adapted to OMP: cost-control guidance rewritten around OMP model roles and interactive routing surfaces |
| `ECC/skills/regex-vs-llm-structured-text/SKILL.md` | `skills/regex-vs-llm-structured-text/SKILL.md` | Adapted to OMP: compact deterministic-first parsing guidance with OMP cost-routing references |
| `ECC/skills/prompt-optimizer/SKILL.md` | `skills/prompt-optimizer/SKILL.md` | Adapted to OMP: advisory prompt-rewrite workflow mapped to OMP commands, skills, and agents instead of direct execution |
| `ECC/skills/skill-stocktake/SKILL.md` | `skills/skill-stocktake/SKILL.md` | Adapted to OMP: local-first audit workflow for OMP/native extension skill portfolios instead of Claude-only stocktake scripts |

## Ported Rules

| OMP Rule | Purpose |
|---|---|
| `rules/hkx-common-security.md` | Security defaults for workflow changes |
| `rules/hkx-common-testing.md` | Test quality defaults |
| `rules/hkx-common-coding-style.md` | General coding style defaults |
| `rules/hkx-common-code-review.md` | Review triggers, severity, checklist, and approval criteria |
| `rules/hkx-common-development-workflow.md` | OMP-native research, plan, TDD, review, verify, and handoff workflow |
| `rules/hkx-common-git-workflow.md` | Commit, PR, branch, release, and history-safety guidance |
| `rules/hkx-common-patterns.md` | Reuse-first, repository, API response, and integration boundary patterns |
| `rules/hkx-common-performance.md` | Measurement-first performance, model routing, context, and troubleshooting guidance |
| `rules/hkx-typescript.md` | TypeScript and JavaScript guidance |
| `rules/hkx-python.md` | Python guidance |
| `rules/hkx-rust.md` | Rust guidance |
| `rules/hkx-go.md` | Go guidance |
| `rules/hkx-ts-no-console-log.md` | TTSR warning for `console.log` |
| `rules/hkx-rust-no-unwrap.md` | TTSR warning for Rust panic helpers |
| `rules/hkx-python-no-bare-except.md` | TTSR warning for bare `except` |
| `rules/hkx-web-design-quality.md` | Prompt-time web UI design-quality guidance adapted from `HKX/rules/web/design-quality.md` |
| `rules/hkx-web-performance.md` | Prompt-time Core Web Vitals, bundle, media, font, and motion guidance adapted from `HKX/rules/web/performance.md` |

## Ported Extension Behavior

| HKX Source | OMP Surface | Notes |
|---|---|---|
| `HKX/rules/typescript/hooks.md` | `rules/hkx-ts-no-console-log.md` and `extensions/hkx-language-quality.ts` | Prompt-time reminder plus edit/write notification |
| `HKX/rules/rust/hooks.md` | `rules/hkx-rust-no-unwrap.md` and `extensions/hkx-language-quality.ts` | Prompt-time panic reminder plus Rust validation reminder |
| `HKX/rules/python/hooks.md` | `rules/hkx-python-no-bare-except.md` and `extensions/hkx-language-quality.ts` | Prompt-time exception reminder plus Python validation reminder |
| `HKX/rules/golang/hooks.md` | `extensions/hkx-language-quality.ts` | Go validation reminder after relevant writes |
| `ECC/scripts/hooks/gateguard-fact-force.js` | `extensions/hkx-gateguard.ts` | Pre-execution fact-forcing gate using OMP `tool_call` hook; blocks first edit/write per file and destructive bash; synced ECC evidence, denial-limit stability, and bash patterns (2026-06-23) |

The `hkx-language-quality.ts` extension is notify-only. It does not run formatters or edit files automatically.

The `hkx-gateguard.ts` extension blocks tool execution via the `tool_call` event. Disable per-session with `HKX_GATEGUARD=off`.

## Ported MCP

| HKX Source | OMP Surface | Notes |
|---|---|---|
| `HKX/.mcp.json` | `.mcp.json` | Standard default MCP server configurations, automatically loaded by OMP's extension plugin loader |
| `HKX/mcp-configs/mcp-servers.json` | `mcp-configs/mcp-servers.json` | Sanitized reference catalog of common MCP configurations (removed Claude/HKX install-specific details) |

OMP-native addition: `mcp-configs/templates/*.json` plus `scripts/apply-mcp-profile.mjs` provide small additive MCP templates for `memory`, `sequential-thinking`, and `firecrawl`. This keeps the root `.mcp.json` lean while giving OMP users an explicit opt-in path at `.omp/mcp.json`, `~/.omp/agent/mcp.json`, or a named OMP profile's `agent/mcp.json`.

### Deferred MCP Surfaces

- `HKX/scripts/lib/mcp-config.js` and associated tests: The install/sync filter `HKX_DISABLED_MCPS` is not ported as-is. OMP uses additive merges through `mcp-configs/templates/*.json` and `scripts/apply-mcp-profile.mjs` instead of HKX-specific env filtering.
- `HKX/scripts/hooks/mcp-health-check.js` and other hook-based MCP utilities: These are harness-specific and are managed natively by OMP's internal extension/plugin capabilities.

## Ported Agents
| HKX Source | OMP Target | Notes |
|---|---|---|
| `ECC/agents/code-architect.md` | `agents/code-architect.md` | Adapted to OMP: tools changed to `[read, grep, glob]` (read-only), model set to `pi/slow`, removed Prompt Defense Baseline |
| `ECC/agents/code-explorer.md` | `agents/code-explorer.md` | Adapted to OMP: model set to `pi/slow`, removed Prompt Defense Baseline; tools kept as `[read, grep, glob]` |
| `ECC/agents/code-simplifier.md` | `agents/code-simplifier.md` | Adapted to OMP: tools changed to `[read, grep, glob, write, edit, bash]`, model set to `pi/slow`, removed Prompt Defense Baseline |
| `HKX/agents/code-reviewer.md` | `agents/code-reviewer.md` | Portable OMP general code reviewer; evidence-gated findings and no mutation behavior |
| `HKX/agents/doc-updater.md` | `agents/doc-updater.md` | Portable OMP documentation and codemap specialist with canonical tools and evidence-backed updates |
| `HKX/agents/go-build-resolver.md` | `agents/go-build-resolver.md` | Full OMP canonical tools; simplified commands; replaced `grep` check on `go.mod` with OMP tool-based `read`/`search` instructions |
| `HKX/agents/go-reviewer.md` | `agents/go-reviewer.md` | Tools adapted to OMP canonical names; references `go-workflow` and `hkx-go` |
| `HKX/agents/pr-test-analyzer.md` | `agents/pr-test-analyzer.md` | Portable OMP test-quality reviewer focused on changed behavior and regression risk |
| `HKX/agents/python-reviewer.md` | `agents/python-reviewer.md` | Tools adapted to OMP canonical names; references skill `python-workflow` and rule `hkx-python` |
| `HKX/agents/rust-build-resolver.md` | `agents/rust-build-resolver.md` | Full OMP canonical tools; simplified commands; replaced `grep` checks for `edition`/`rust-version` with OMP tool-based `read`/`search` instructions |
| `HKX/agents/rust-reviewer.md` | `agents/rust-reviewer.md` | Tools adapted to OMP canonical names; simplified diagnostic commands to remove prohibited pipes and redirections; references `rust-workflow`/`rust-patterns`/`rust-testing` |
| `HKX/agents/security-reviewer.md` | `agents/security-reviewer.md` | Portable OMP security reviewer; read-only findings with canonical tools and `pi/slow` model |
| `HKX/agents/silent-failure-hunter.md` | `agents/silent-failure-hunter.md` | Portable OMP reviewer for swallowed errors, bad fallbacks, and missing propagation |
| `HKX/agents/typescript-reviewer.md` | `agents/typescript-reviewer.md` | Adapted tools to OMP canonical names; updated rules/skills references; model set to `pi/slow` |
| `HKX/agents/build-error-resolver.md` | `agents/build-error-resolver.md` | Enabled OMP canonical tools; updated references to local commands/skills (`hkx-refactor-clean`, `hkx-plan`, `tdd-workflow`) |
| `ECC/agents/agent-evaluator.md` | `agents/agent-evaluator.md` | OMP adaptation: tools `[read, search, find, bash, lsp, ast_grep]`, model `pi/slow`, kept Prompt Defense Baseline and Bash read-only constraints; removed `scripts/evaluate.py` output binding (template inlined); evaluates agent output on 5 axes, orthogonal to `code-reviewer` (which reviews code) |
| `ECC/agents/architect.md` | `agents/architect.md` | OMP adaptation: read-only architecture/tradeoff agent with canonical tools `[read, search, find]` and `pi/slow` model |
| `ECC/agents/planner.md` | `agents/planner.md` | OMP adaptation: read-only implementation planner with canonical tools `[read, search, find]` and OMP validation/risk framing |
| `ECC/agents/tdd-guide.md` | `agents/tdd-guide.md` | OMP adaptation: write-capable TDD agent using canonical tools, OMP validation language, and `hkx-tdd-workflow` references |
| `ECC/agents/refactor-cleaner.md` | `agents/refactor-cleaner.md` | OMP adaptation: cleanup/refactor agent using canonical tools, conservative deletion rules, and behavior-preservation framing |
| `ECC/agents/docs-lookup.md` | `agents/docs-lookup.md` | OMP adaptation: docs-search agent using `web_search` plus local evidence instead of direct MCP-prefixed tool names |
| `ECC/agents/e2e-runner.md` | `agents/e2e-runner.md` | OMP adaptation: E2E agent aligned to OMP browser tool and repo-native test stacks |
| `ECC/agents/database-reviewer.md` | `agents/database-reviewer.md` | OMP adaptation: PostgreSQL reviewer using canonical tools and OMP skill references (`hkx-postgres-patterns`, `hkx-database-migrations`) |
| `ECC/agents/loop-operator.md` | `agents/loop-operator.md` | OMP adaptation: autonomous-loop operator using canonical task/todo/yield tools and `.omp/checkpoints.log` guidance |
| `ECC/agents/harness-optimizer.md` | `agents/harness-optimizer.md` | OMP adaptation: harness-surface optimizer focused on `AGENTS.md`, `.mcp.json`, `.omp/settings.json`, and extension/rule drift |

### Deferred / Skipped Agents

- Framework and domain-specific agents (e.g., `react-reviewer.md`, `django-reviewer.md`, `fastapi-reviewer.md`, `pytorch-build-resolver.md`, `healthcare-reviewer.md`, `marketing-agent.md`, etc.) are skipped because they depend on skills or rules that are not part of `hkx-omp-workflows` core language workflow surface. They are deferred as optional pack extensions.

## Deferred

Deferred for later packages:

- Shell hook packs and hookify flows, because OMP extensions use TypeScript modules rather than shell hook files.
- External multi-model wrapper commands, because OMP already has in-process agents and eval fan-out.
- Session history commands tied to a different session store.
- Continuous-learning scripts tied to another home-directory layout.
- Large language-specific skill catalogs. These should be grouped into separate optional packs.

## Naming

Commands and skills use the `hkx-` prefix to avoid collisions with OMP built-ins and user-installed skills.
