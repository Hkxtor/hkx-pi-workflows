# Command–Agent Map (hkx-pi-workflows)

**Status**: active. This is the operator-facing map of how each agent in `agents/` is entered (chain / command / skill), the differences vs the upstream ECC map, and the unported items.

- Upstream authority: ECC `docs/COMMAND-AGENT-MAP.md`
- Implementation trail: `docs/command-agent-map-checklist.md` (M1/M2 audit, frozen)
- PRD: `.pi/prds/port-command-agent-map.prd.md` (closed at M3)

## Command → Agent (direct invocation)

Eight agents are not reached through packaged chains; they are entered directly via commands, the `plan-orchestrate` catalogue, or skill routing.

| Agent | Entrance | Where |
|---|---|---|
| `loop-operator` | `/loop-start`, `/loop-status` | `commands/loop-start.md:41`, `commands/loop-status.md:35`; also `plan-orchestrate` `loop` tag |
| `conversation-analyzer` | `/hookify`, `/hookify-help` | `commands/hookify.md:34` (`hkx.conversation-analyzer`, read-only fallback), `commands/hookify-help.md:19` |
| `harness-optimizer` | `/harness-audit` | `commands/harness-audit.md:37` |
| `database-reviewer` | `plan-orchestrate` catalogue + `db` tag; DB skills | `skills/plan-orchestrate/SKILL.md:70`, `:135`; `skills/postgres-patterns/`, `skills/redis-patterns/` |
| `docs-lookup` | `plan-orchestrate` catalogue + `lookup` tag; documentation skill | `skills/plan-orchestrate/SKILL.md:68`, `:139`; `skills/documentation-lookup/SKILL.md:48` (Pair With) |
| `e2e-runner` | `/e2e` | `commands/e2e.md` (thin entrance → `hkx.e2e-runner` + `e2e-testing` skill); also catalogue `:69` + `test` tag `:132` |
| `architect` | `plan-orchestrate` `design` tag; orchestration skills; `/multi-workflow` thin router | `skills/plan-orchestrate/SKILL.md:61`, `:129`; `skills/orch-pipeline/SKILL.md:67`; `commands/multi-workflow.md` |
| `code-architect` | `plan-orchestrate` catalogue + `design` tag; orchestration skill | `skills/plan-orchestrate/SKILL.md:62`, `:129`; `skills/orch-pipeline/SKILL.md:67` |

## Chain Routes (14 chains)

Agent sequences inside `chains/*.chain.json` (parallel steps in brackets):

| Chain | Agent sequence |
|---|---|
| `hkx-adversarial-review` | [code-reviewer + security-reviewer + pr-test-analyzer + silent-failure-hunter + typescript-reviewer] → agent-evaluator |
| `hkx-docs-update` | code-explorer → doc-updater → code-reviewer |
| `hkx-feature-flow` | code-explorer → planner → tdd-guide → [code-reviewer + security-reviewer + pr-test-analyzer] |
| `hkx-fix-defect` | code-explorer → planner → tdd-guide → [code-reviewer + silent-failure-hunter + pr-test-analyzer] |
| `hkx-go-build-fix` | go-build-resolver → [go-reviewer + code-reviewer + silent-failure-hunter] |
| `hkx-go-review` | [go-reviewer + security-reviewer + pr-test-analyzer + silent-failure-hunter] → agent-evaluator |
| `hkx-pr-review` | [code-reviewer + security-reviewer + pr-test-analyzer + silent-failure-hunter] → agent-evaluator |
| `hkx-python-build-fix` | python-build-resolver → [python-reviewer + code-reviewer + silent-failure-hunter] |
| `hkx-python-review` | [python-reviewer + security-reviewer + pr-test-analyzer + silent-failure-hunter] → agent-evaluator |
| `hkx-refactor-flow` | code-explorer → planner → refactor-cleaner → [code-reviewer + pr-test-analyzer] |
| `hkx-rust-build-fix` | rust-build-resolver → [rust-reviewer + code-reviewer + silent-failure-hunter] |
| `hkx-rust-review` | [rust-reviewer + security-reviewer + pr-test-analyzer + silent-failure-hunter] → agent-evaluator |
| `hkx-security-scan` | [security-reviewer + silent-failure-hunter + code-reviewer] → agent-evaluator |
| `hkx-typescript-build-fix` | build-error-resolver → [typescript-reviewer + code-reviewer + silent-failure-hunter] |

## Differences vs ECC

| ECC map entry | hkx behavior |
|---|---|
| `/multi-workflow` / `/multi-plan` / `/multi-execute` / `/multi-backend` / `/multi-frontend` → architect (+ Codex/Gemini external prompts) | merged into single thin router `commands/multi-workflow.md` — in-process pi-subagents only, no external `codeagent-wrapper` / `ccg-workflow` |
| `/e2e` → e2e-runner | upstream moved to `legacy-command-shims`; hkx ships a fresh thin `commands/e2e.md` routing to `hkx.e2e-runner` + `e2e-testing` skill |
| `/harness-audit` — "no single agent" | hkx routes it to `harness-optimizer` (`commands/harness-audit.md:37`) — intentional improvement upstream lacks |
| `conversation-analyzer` absent from ECC map rows | hkx binds it via `commands/hookify.md` / `hookify-help.md` (ECC references exist only in `commands/hookify.md:18`, not in its map) |
| 26 shared agent files, ECC↔hkx all differ | expected: hkx agents are Pi-adapted rewrites; content drift is record-only (see checklist), sync is a separate scope |

## Unported / Deferred

| Item | Decision | Reason |
|---|---|---|
| `/feature-dev` command | ported | `commands/feature-dev.md` — standard pi command delegating to `hkx.code-explorer` / `hkx.code-architect` / `hkx.code-reviewer` (+ `hkx.security-reviewer` for sensitive changes); no orchestration chains required |
| `/multi-plan` / `/multi-execute` / `/multi-backend` / `/multi-frontend` as separate commands | not ported | folded into `commands/multi-workflow.md` modes; separate commands would duplicate the thin router |
| ECC `/orchestrate` as a command | not ported | superseded by `skills/orch-pipeline` + `commands/hkx-orch-*` family |

## 26/26 Agent Entrance Coverage (R5)

Every shipped agent has at least one entrance of type chain / command / skill. Rows marked ✓ in a chain column appear in the chain table above; command/skill columns list file-level entrances.

| Agent | Chains | Commands | Skills |
|---|---|---|---|
| agent-evaluator | 6 review chains | — | agent-self-evaluation |
| architect | — | — | code-tour, council, orch-pipeline, plan-orchestrate |
| build-error-resolver | typescript-build-fix | orch-fix-defect | orch-fix-defect, orch-pipeline, plan-orchestrate |
| code-architect | — | — | orch-pipeline, plan-orchestrate |
| code-explorer | 4 flow chains | multi-workflow, orch-fix-defect | orch-fix-defect, orch-pipeline, plan-orchestrate |
| code-reviewer | 11 chains | blueprint, orch-review, review-pr, santa-loop | blueprint, council, orch-pipeline, orch-review, plan-orchestrate, santa-method |
| conversation-analyzer | — | hookify, hookify-help | — |
| database-reviewer | — | — | plan-orchestrate, postgres-patterns, redis-patterns |
| doc-updater | docs-update | — | plan-orchestrate |
| docs-lookup | — | — | plan-orchestrate, documentation-lookup (Pair With) |
| e2e-runner | — | e2e | plan-orchestrate |
| go-build-resolver | go-build-fix | orch-fix-defect | plan-orchestrate |
| go-reviewer | 2 chains | orch-review | orch-pipeline, orch-review, plan-orchestrate |
| harness-optimizer | — | harness-audit | plan-orchestrate |
| loop-operator | — | loop-start, loop-status | plan-orchestrate |
| planner | 3 flow chains | blueprint, multi-workflow | blueprint, council, orch-change-feature, orch-pipeline, plan-orchestrate |
| pr-test-analyzer | 8 chains | review-pr | — |
| python-build-resolver | python-build-fix | orch-fix-defect | plan-orchestrate |
| python-reviewer | 2 chains | orch-review | orch-pipeline, orch-review, plan-orchestrate |
| refactor-cleaner | refactor-flow | orch-refine-code | orch-refine-code, plan-orchestrate |
| rust-build-resolver | rust-build-fix | orch-fix-defect | plan-orchestrate |
| rust-reviewer | 2 chains | orch-review | orch-pipeline, orch-review, plan-orchestrate |
| security-reviewer | 9 chains | orch-add-feature, orch-review, review-pr, santa-loop | orch-pipeline, plan-orchestrate, santa-method, +6 more |
| silent-failure-hunter | 11 chains | orch-review, review-pr | orch-review |
| tdd-guide | 3 chains | — | orch-pipeline, plan-orchestrate |
| typescript-reviewer | 2 chains | orch-review | orch-pipeline, orch-review, plan-orchestrate |

**Verification**: `docs/command-agent-map-checklist.md` holds the grep-verified script that confirms all 26 rows; the same check is re-run as part of the M3 validation (`26/26 PASS`).