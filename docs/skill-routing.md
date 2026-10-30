# Skill Routing

One-page map for choosing among overlapping Pi skills.

Use this when:

- several skills could match the same user ask
- descriptions look similar and you need a single primary skill
- you are writing or reviewing skill `description` frontmatter

This is a **routing guide**, not a full inventory. For the shipped catalog, see `conversion-map.md`. For layer placement (command vs skill vs agent), see `architecture.md`.

## How To Use

1. Match the user ask to a **family** below.
2. Load the **Primary** skill first.
3. Add **May also load** skills only when that specialized need is real.
4. Do **not** load the **Avoid as primary** skills for that ask.

Prefer one primary skill. Stack only when the task has two distinct phases (for example: implement → verify, or inventory → cleanup).

## Quick Router

| User says (examples) | Primary skill | May also load | Not primary |
| --- | --- | --- | --- |
| research / compare options / current facts | `research-ops` | `deep-research`, `exa-search`, `market-research`, `documentation-lookup` | `search-first` |
| should we add a dependency / build vs reuse | `search-first` | `documentation-lookup`, `research-ops` | `deep-research` |
| library / SDK / API docs for version X | `documentation-lookup` | — | `research-ops`, `exa-search` |
| competitor / market / fund diligence | `market-research` | `research-ops` | `deep-research` as first stop |
| Exa tool calls only | `exa-search` | (via `research-ops`) | standalone cited report |
| security of Pi config / MCP / hooks | `security-scan` | `workspace-surface-audit` | `security-review` |
| security of auth / permissions / threat model | `security-review` | `safety-guard` | `security-scan` |
| prevent repeated agent behavior / write hookify rule | `hookify-rules` | `/hookify`, GateGuard only for destructive bash | `instinct-evolve` (cross-session) |
| gate destructive shell commands | `gateguard` | `safety-guard` | `hookify-rules` |
| run checks after code change | `verification-loop` | language `*-workflow` | `delivery-gate` first |
| session done / delivery hygiene | `delivery-gate` | `verification-loop` (if not green), `session-summary` | `agent-self-evaluation` first |
| score my output quality | `agent-self-evaluation` | after `delivery-gate` | as a test runner |
| what is installed in this workspace | `workspace-surface-audit` | `automation-audit-ops` | `config-gc` |
| what automation is live / overlapping | `automation-audit-ops` | `workspace-surface-audit` | `skill-stocktake` |
| skill overlap / portfolio health | `skill-stocktake` | `skill-health` command | `config-gc` |
| promote recurring skill principles into rules | `rules-distill` | `skill-stocktake` first, `hookify-rules` when the constraint is mechanically enforceable | `instinct-evolve` (captures behaviors, not rules) |
| control answer length / token budget | `token-budget-advisor` | `context-budget` | `cost-aware-llm-pipeline` (model choice, not answer length) |
| repeated prompts are expensive / raise cache hit rate | `prompt-caching-strategy` | `context-budget`, `cost-aware-llm-pipeline` | `prompt-optimizer` (quality, not reuse) |
| review MCP config for mutable package pins | `mcp-dependency-review` | `security-scan`, `search-first` | `mcp-server-patterns` (building the server, not vetting the config) |
| find the right command sequence for a workflow | `ecc-recipes` | `/recipes` (operator entrance) | `hkx-plan-orchestrate` (multi-step agent chains) |
| draft a commit message from staged changes | `conventional-commit-review` | `hkx-common-git-workflow` rule | `coding-standards` (diff content, not message) |
| stop AI style drift on a legacy codebase | `inherit-legacy-style` | `coding-standards`, `grilling` | `codebase-onboarding` (map, not rules) |
| docs are rotting / deleted files keep coming back | `living-docs-governance` | `architecture-decision-records`, `code-tour` | `codebase-onboarding` (first-pass map) |
| extract baseline behavior specs from a brownfield module | `code-explorer` agent, `mine` mode | `change-impact`, `tdd-workflow` | `codebase-onboarding` |
| clean up my config / too many skills | `config-gc` | after stocktake/audit | any read-only audit as delete tool |
| why build this / product diagnostic | `product-lens` | `council` | `product-capability` first |
| PRD → capability / interfaces | `product-capability` | `intent-driven-development` | `product-lens` only |
| acceptance criteria for this change | `intent-driven-development` | `tdd-workflow` | `council` |
| blast radius / what breaks if I change this | `change-impact` | `repo-scan`, `verification-loop` | `production-audit` (release readiness) |
| frontend and backend evolving one API in parallel | `contract-first` | `api-design`, `ai-regression-testing` | `api-design` alone when the shape is the question, not the coordination |
| multi-path go/no-go tradeoff | `council` | `product-lens` | routine implementation |
| stress-test a plan / grill me | `grill-with-docs` | `grilling`, `domain-modeling` | `council` (decisions, not interview) |
| record a durable decision / ADR | `architecture-decision-records` | `domain-modeling` (lighter, inline) | `grill-with-docs` (interview-driven) |
| glossary / CONTEXT.md terms | `domain-modeling` | `architecture-decision-records` (for decisions) | `unified-memory` (vault, not glossary) |
| dual independent review until ship-ready | `santa-method` | `verification-loop` first | `council` (decisions, not correctness) |
| build autonomously to a scored quality bar | `gan-style-harness` | `/gan-build` (operator entrance), `loop-design-check` (loop contract), `browser-qa` (live probing) | `santa-method` (review, no build loop) |
| extract session patterns as instincts | `instinct-evolve` | commands `learn` / `learn-eval` | `growth-log` (human journal) |
| durable project/user context vault | `unified-memory` | `/unified-memory` / CLI `memory` | `instinct-evolve` (behaviors) or `/om` (session) |
| multi-session multi-PR construction plan | `blueprint` | `/hkx-plan-canvas` for approve | `/hkx-plan` for single-session |
| browser annotate/approve a local plan | `plan-canvas` | after `/hkx-plan` or `/blueprint` | code review commands |
| audit agents/skills/MCP token tax | `context-budget` | `skill-stocktake`, `workspace-surface-audit` | `strategic-compact` (mid-session) |
| UI design direction | `frontend-design-direction` | `design-system` | `browser-qa` |
| design tokens / system audit | `design-system` | `make-interfaces-feel-better` | `accessibility` only |
| implement React/TS UI | `frontend-patterns` | `typescript-workflow`, `accessibility` | `browser-qa` first |
| polish spacing/type/shadows | `make-interfaces-feel-better` | `design-system` | WCAG-only `accessibility` |
| WCAG / keyboard / ARIA | `accessibility` | `frontend-patterns` | `browser-qa` as sole a11y process |
| post-deploy browser smoke/visual | `browser-qa` | `canary-watch` | `e2e-testing` authoring |
| write E2E tests | `e2e-testing` | `browser-qa` | `canary-watch` |
| live URL canary after deploy | `canary-watch` | `browser-qa` | `e2e-testing` |
| measure performance numbers | `benchmark` | — | optimize loop first |
| make it faster with measured variants | `benchmark-optimization-loop` | `benchmark` | `latency-critical-systems` for bulk ETL |
| p95 / realtime latency path | `latency-critical-systems` | `benchmark` | `data-throughput-accelerator` |
| ETL / backfill / bulk sync speed | `data-throughput-accelerator` | — | interactive latency skills |
| design an agent loop contract | `loop-design-check` | `parallel-execution-optimizer` | `agent-introspection-debugging` first |
| agent is spinning / lost context | `agent-introspection-debugging` | `strategic-compact` | `loop-design-check` first |
| unfamiliar repo onboarding guide | `codebase-onboarding` | `repo-scan` | `production-audit` |
| ownership / structure inventory | `repo-scan` | `codebase-onboarding` | `production-audit` |
| safe to ship / launch readiness | `production-audit` | `security-review`, `verification-loop` | onboarding skills |
| new feature end-to-end orch | `orch-add-feature` | `orch-pipeline` (shared) | `plan-orchestrate` execution |
| plan → agent invocations only | `plan-orchestrate` | — | any `orch-*` executor |
| Rust change flow | `rust-workflow` | `rust-patterns`, `rust-testing` | patterns-only for cargo flow |
| Rust crates/FFI/unsafe design | `rust-patterns` | `rust-workflow` | `rust-testing` first |
| Rust tests/regressions | `rust-testing` | `rust-workflow` | patterns-only |

Skill directory names are listed without the `hkx-` package prefix used in frontmatter `name` fields.

## Family Detail

### Research

| Role | Skill |
| --- | --- |
| Primary entry / router | `research-ops` |
| Deep cited report | `deep-research` |
| Exa MCP tools | `exa-search` |
| Business diligence | `market-research` |
| External product docs | `documentation-lookup` |
| Pre-coding build-vs-reuse | `search-first` |

Order: classify with `research-ops` (or jump straight to `search-first` / `documentation-lookup` when the ask is already that narrow).

### Security

| Role | Skill |
| --- | --- |
| Config / install surface inventory | `security-scan` |
| Code / auth / tool-permission threat review | `security-review` |
| Operator destructive-action guardrails | `safety-guard` |

### Session quality

| Phase | Skill / command |
| --- | --- |
| After edits | `verification-loop` |
| High-stakes dual review | `santa-method` (`/santa-loop`) |
| Before ending session | `delivery-gate` |
| Optional reflection scorecard | `agent-self-evaluation` |
| Narrative recap | `session-summary` |
| Capture reusable session patterns | `/learn` or `/learn-eval` → `instinct-evolve` |
| Recall/save project memory notes | `/unified-memory` → `unified-memory` |

### Config and portfolio governance

| Role | Skill / command |
| --- | --- |
| Read-only workspace map | `workspace-surface-audit` |
| Read-only automation lanes | `automation-audit-ops` |
| Skill/command quality and overlap | `skill-stocktake` |
| Frontmatter health check | command `skill-health` |
| Confirm-each-deletion cleanup | `config-gc` |

Never start with `config-gc`. Inventory or stocktake first; delete only with explicit user confirmation.

### Product and intent

| Phase | Skill |
| --- | --- |
| Why / diagnostic | `product-lens` |
| Capability contract | `product-capability` |
| Observable acceptance criteria | `intent-driven-development` |
| Multi-path decision | `council` |
| Adversarial correctness review | `santa-method` (not council) |

### Frontend

| Phase | Skill |
| --- | --- |
| Direction | `frontend-design-direction` |
| Tokens / system | `design-system` |
| Implementation | `frontend-patterns` |
| Micro-polish | `make-interfaces-feel-better` |
| WCAG / a11y | `accessibility` |
| Live browser QA | `browser-qa` |

### Performance

| Role | Skill |
| --- | --- |
| Measure | `benchmark` |
| Bounded optimize loop | `benchmark-optimization-loop` |
| Latency architecture | `latency-critical-systems` |
| Bulk data throughput | `data-throughput-accelerator` |

### Agent loops

| Layer | Skill |
| --- | --- |
| Judgment / contract | `loop-design-check` |
| Mechanism: parallel lanes | `parallel-execution-optimizer` |
| Runtime failure debug | `agent-introspection-debugging` |
| Architecture change audit | `agent-architecture-audit` |
| Formal eval harness | `eval-harness` |

### Orchestration

| Role | Skill |
| --- | --- |
| Shared engine (not user-primary) | `orch-pipeline` |
| Operation entries | `orch-add-feature`, `orch-change-feature`, `orch-fix-defect`, `orch-refine-code`, `orch-build-mvp`, `orch-review` |
| Generate agent plan only | `plan-orchestrate` |

**orch skills vs chains — pick one, not both.** The `orch-*` skills and the packaged chains (`hkx-feature-flow`, `hkx-fix-defect`, `hkx-refactor-flow`, review/build-fix chains) cover overlapping delivery paths by design: **chains** are the repeatable, no-gates pipeline (run the whole sequence in one pass, best from routers like `/multi-workflow` or scripts); **orch skills** are the same shapes with **human gates** (plan approval at Gate 1, commit approval at Gate 2) plus per-operation first-move rules. When the operator is interactively driving, prefer the orch skill; when the operator asked for an end-to-end run or comes in through a router, prefer the chain. Do not nest one inside the other — that duplicates review lanes and re-runs gates.

### Repo understanding

| Role | Skill |
| --- | --- |
| Structural inventory | `repo-scan` |
| Human/agent onboarding guide | `codebase-onboarding` |
| Launch readiness | `production-audit` |

### Language workflows

| Language | Primary | Deeper specialists |
| --- | --- | --- |
| TypeScript / JS | `typescript-workflow` | `bun-runtime`, `frontend-patterns` |
| Python | `python-workflow` | — |
| Go | `go-workflow` | — |
| Rust | `rust-workflow` | `rust-patterns`, `rust-testing` |
| Cross-language style | `coding-standards` | — |
| Test-first process | `tdd-workflow` | — |

## Command vs skill twins

Some commands share a name with a skill. Use the **command** as the operator entry; use the **skill** for reusable procedure detail.

| Command | Skill | Notes |
| --- | --- | --- |
| `delivery-gate` | `delivery-gate` | Same delivery checklist lane |
| `hkx-session-summary` | `session-summary` | Session recap |
| `santa-loop` | `santa-method` | Dual independent review convergence |
| `learn` / `learn-eval` | `instinct-evolve` | Session → pending instincts |
| `unified-memory` | `unified-memory` | Homunculus vault recall/save/validate |
| `blueprint` | `blueprint` | Multi-session construction plan |
| `hkx-plan-canvas` | `plan-canvas` | Browser annotate/approve |
| `context-budget` | `context-budget` | Install-surface token audit |
| `security-scan` | `security-scan` | Config security scan |
| `hookify` / `list` / `configure` / `help` | `hookify-rules` | Pattern guardrails; runtime `hkx-hookify` extension |
| `hkx-orch-*` | matching `orch-*` | Orchestrated operations |
| `skill-health` | (pairs with `skill-stocktake`) | Health = frontmatter; stocktake = overlap/quality |
| `recipes` | `ecc-recipes` | Which command group runs my workflow, in what order, and when to stop |

Commands should stay thin. If guidance grows, keep it in the skill and point the command at that skill.

### Flagged as overlaps, verified not to be

Name similarity is not duplication. These three families were flagged in the 2026-10 fold audit as selection friction and re-checked: each is a deliberate composition, so nothing was merged or retired.

| Family | Why it is not a duplicate |
| --- | --- |
| `grilling` / `grill-with-docs` | `grill-with-docs` is a thin orchestrator that loads `grilling` **plus** `domain-modeling`; it also sets `disable-model-invocation: true`, so the model cannot pick it by accident — it fires only when the operator names it. |
| `research-ops` / `deep-research` / `market-research` / `exa-search` / `documentation-lookup` / `search-first` | Each description carries an explicit "not for X, use Y instead" clause and `research-ops` is the declared entry. Six skills with disjoint triggers beat one skill that has to be re-read to disambiguate. |
| `recipes` command / `ecc-recipes` skill | Command is the operator entrance, skill holds the procedure — the same thin-command pattern as `delivery-gate` and `santa-loop`. |

## Agent routing (hkx.*)

Agents are invoked through pi-subagents (`subagent` tool / chains), not loaded like skills. The pairs below overlap by design; pick by scope, not by name similarity.

### Planning and design (main session)

The planner/architect/code-architect agents were folded in the 2026-10 fold migration: design procedure is process knowledge, so it lives in skills/commands consumed by the main session instead of fresh-context subagents.

| User says (examples) | Primary surface |
| --- | --- |
| system boundaries / service split / API contract / migration & rollback shape | skill `hexagonal-architecture`, `api-design`, `domain-modeling` + `/hkx-plan` |
| design this feature to fit the existing codebase / blueprint with files, interfaces, build order | command `/hkx-plan` (step quality + sizing/phasing) + `feature-dev` Phase 4 in-session blueprint |
| requirement restatement, step ordering, validation sequence | command `/hkx-plan`; skill `intent-driven-development` |

Division of labor:

- **System-layer design** (module/service boundaries, data ownership, API contracts, migration/rollback) is covered by `hexagonal-architecture` / `api-design` guidance plus `/hkx-plan`.
- **Feature-layer blueprinting** (concrete files, interfaces, data flow, build order) runs in `/hkx-plan` or `feature-dev` Phase 4 directly from the exploration evidence — no lossy mid-chain handoff.
- Repo evidence gathering stays with `hkx.code-explorer` (context isolation earns its keep: heavy raw reads, use-and-discard). Adversarial review of a plan uses a fresh `hkx.code-reviewer`.

### Build recovery vs behavior changes

| User says (examples) | Primary agent | Not primary |
| --- | --- | --- |
| Python cannot install/import/typecheck/lint/collect tests | `hkx.python-build-resolver` | `hkx.tdd-guide` |
| TypeScript/JavaScript cannot build or typecheck | `hkx.build-error-resolver` | `hkx.tdd-guide` |
| Go or Rust cannot compile/check | matching `hkx.go-build-resolver` / `hkx.rust-build-resolver` | `hkx.tdd-guide` |
| observable behavior is wrong or must change | `hkx.tdd-guide` | build resolver |

Build resolvers restore the existing check contract with minimal changes. `hkx.tdd-guide` changes or locks behavior through red-green-refactor. If a failing Python test exposes a behavior/spec defect rather than an import, collection, configuration, or dependency failure, the Python resolver must hand it to `hkx.tdd-guide` instead of changing behavior silently.

## Description authoring rules

When adding or editing a skill `description`:

1. State the **primary job** in one sentence.
2. Start or include a clear **Use when**.
3. Name the closest cousins under **Not for** / **Prefer X for Y**.
4. If the skill is a tool adapter (for example Exa), say it is **not** the research router.
5. If the skill is a router (for example `research-ops`, pack routers), say what it **routes to**.
6. **Quote the YAML value** when the text contains `:` (almost always for routing prose). Example: `description: "Do X: a, b. Use when Y. Not for Z."` — unquoted colons break compact YAML parsers with `Nested mappings are not allowed in compact mappings`.

Periodic overlap reviews: use `skill-stocktake`. Cleanup after decisions: use `config-gc` with confirmation.

## Related docs

- `docs/README.md` — documentation index
- `docs/architecture.md` — command vs skill vs agent layers
- `docs/conversion-map.md` — full shipped surface map
- `skills/skill-stocktake/SKILL.md` — portfolio audit process
