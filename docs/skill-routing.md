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
| run checks after code change | `verification-loop` | language `*-workflow` | `delivery-gate` first |
| session done / delivery hygiene | `delivery-gate` | `verification-loop` (if not green), `session-summary` | `agent-self-evaluation` first |
| score my output quality | `agent-self-evaluation` | after `delivery-gate` | as a test runner |
| what is installed in this workspace | `workspace-surface-audit` | `automation-audit-ops` | `config-gc` |
| what automation is live / overlapping | `automation-audit-ops` | `workspace-surface-audit` | `skill-stocktake` |
| skill overlap / portfolio health | `skill-stocktake` | `hkx-skill-health` command | `config-gc` |
| clean up my config / too many skills | `config-gc` | after stocktake/audit | any read-only audit as delete tool |
| why build this / product diagnostic | `product-lens` | `council` | `product-capability` first |
| PRD → capability / interfaces | `product-capability` | `intent-driven-development` | `product-lens` only |
| acceptance criteria for this change | `intent-driven-development` | `tdd-workflow` | `council` |
| multi-path go/no-go tradeoff | `council` | `product-lens` | routine implementation |
| dual independent review until ship-ready | `santa-method` | `verification-loop` first | `council` (decisions, not correctness) |
| extract session patterns as instincts | `instinct-evolve` | commands `hkx-learn` / `hkx-learn-eval` | `growth-log` (human journal) |
| multi-session multi-PR construction plan | `blueprint` | `/hkx-plan-canvas` for approve | `/hkx-plan` for single-session |
| browser annotate/approve a local plan | `plan-canvas` | after `/hkx-plan` or `/hkx-blueprint` | code review commands |
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
| High-stakes dual review | `santa-method` (`/hkx-santa-loop`) |
| Before ending session | `delivery-gate` |
| Optional reflection scorecard | `agent-self-evaluation` |
| Narrative recap | `session-summary` |
| Capture reusable session patterns | `/hkx-learn` or `/hkx-learn-eval` → `instinct-evolve` |

### Config and portfolio governance

| Role | Skill / command |
| --- | --- |
| Read-only workspace map | `workspace-surface-audit` |
| Read-only automation lanes | `automation-audit-ops` |
| Skill/command quality and overlap | `skill-stocktake` |
| Frontmatter health check | command `hkx-skill-health` |
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
| `hkx-delivery-gate` | `delivery-gate` | Same delivery checklist lane |
| `hkx-session-summary` | `session-summary` | Session recap |
| `hkx-santa-loop` | `santa-method` | Dual independent review convergence |
| `hkx-learn` / `hkx-learn-eval` | `instinct-evolve` | Session → pending instincts |
| `hkx-blueprint` | `blueprint` | Multi-session construction plan |
| `hkx-plan-canvas` | `plan-canvas` | Browser annotate/approve |
| `hkx-context-budget` | `context-budget` | Install-surface token audit |
| `hkx-security-scan` | `security-scan` | Config security scan |
| `hkx-orch-*` | matching `orch-*` | Orchestrated operations |
| `hkx-skill-health` | (pairs with `skill-stocktake`) | Health = frontmatter; stocktake = overlap/quality |

Commands should stay thin. If guidance grows, keep it in the skill and point the command at that skill.

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
