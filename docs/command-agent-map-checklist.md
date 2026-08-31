# Command–Agent Map Port Checklist

**Status**: frozen audit trail (M1/M2 conclusions; folded into the operator-facing `docs/command-agent-map.md` at M3). Authoritative sources:

- Upstream intent: `ECC/docs/COMMAND-AGENT-MAP.md`
- Grading evidence: grep-verified file:line references inside this repo (`chains/`, `commands/`, `skills/`) — every grade below carries at least one such reference
- Plan: `.pi/plans/port-command-agent-map-m1.plan.md` · PRD: `.pi/prds/port-command-agent-map.prd.md`

Grades: ✅ covered · ⚠️ partial · ❌ gap · ⛔ not-ported

## ECC map rows that reference the 8 target agents

| ECC entry (from COMMAND-AGENT-MAP.md) | Primary agent(s) | Notes |
|---|---|---|
| `/e2e` | e2e-runner | upstream /e2e has moved to `ECC/legacy-command-shims/commands/e2e.md` (drift) |
| `/loop-start` | loop-operator | |
| `/loop-status` | loop-operator | |
| `/orchestrate` | planner, tdd-guide, code-reviewer, security-reviewer, architect | |
| `/multi-plan` | architect | uses Codex/Gemini external prompts — not portable as-is |
| `/multi-execute` | architect | same external dependency |
| `/multi-backend` | architect | |
| `/multi-frontend` | architect | |
| `/multi-workflow` | architect | |

ECC source-level references beyond the map (grep-verified in ECC):

- `conversation-analyzer` ← `ECC/commands/hookify.md:18`
- `code-architect` ← `ECC/commands/feature-dev.md:29`, `ECC/skills/orch-pipeline/SKILL.md`
- `database-reviewer` ← ECC skills `postgres-patterns`, `mysql-patterns`, `redis-patterns`, `mle-workflow`; ECC plan-orchestrate `db` key-route
- `docs-lookup` / `e2e-runner` / `harness-optimizer` / `loop-operator` ← ECC plan-orchestrate catalogue rows
- drift: ECC map lists `/harness-audit | — | no single agent`, while hkx's `commands/harness-audit.md:37` delegates to `harness-optimizer` (intentional hkx improvement, keep)

## Per-agent assessment

| agent | ECC entrance | hkx entrance (file:line) | Grade | Suggested action |
|---|---|---|---|---|
| loop-operator | `/loop-start`, `/loop-status`, plan-orchestrate catalogue | `commands/loop-start.md:41`, `commands/loop-status.md:35`, catalogue `skills/plan-orchestrate/SKILL.md:72`, `loop` tag `:141` | ✅ covered | none — parity achieved |
| conversation-analyzer | `/hookify` (not listed in ECC map — map gap) | `commands/hookify.md:34-35` (agent + read-only fallback), `commands/hookify-help.md:19` | ✅ covered | none |
| harness-optimizer | plan-orchestrate catalogue; ECC map marks `/harness-audit` agentless | `commands/harness-audit.md:37`, catalogue `skills/plan-orchestrate/SKILL.md:71` | ✅ covered | none (hkx improves on upstream here) |
| database-reviewer | ECC plan-orchestrate `db` route + ECC skills postgres/mysql/redis/mle | catalogue `skills/plan-orchestrate/SKILL.md:70`, `db` tag `:135`, hkx skills `postgres-patterns`, `redis-patterns` | ✅ covered | none |
| docs-lookup | ECC plan-orchestrate `lookup` route | catalogue `skills/plan-orchestrate/SKILL.md:68`, `lookup` tag `:139`, `skills/documentation-lookup/SKILL.md` Pair With cross-ref | ✅ covered | none — parity achieved (M2) |
| e2e-runner | ECC `/e2e` (now legacy upstream) + `test` route | catalogue `skills/plan-orchestrate/SKILL.md:69`, `test` tag `:132`, `skills/e2e-testing/`, thin `commands/e2e.md` (`hkx.e2e-runner`) | ✅ covered | none — parity achieved (M2) |
| architect | ECC `/orchestrate` + `/multi-*` family (Codex/Gemini external deps) | catalogue `skills/plan-orchestrate/SKILL.md:61`, `design` tag `:129`, `skills/orch-pipeline/SKILL.md:67`, `skills/council/`, `skills/code-tour/`; `/multi-*` merged into thin `commands/multi-workflow.md` (named at `:90` as read-only agent, M3) | ✅ covered | none — parity achieved (M3) |
| code-architect | ECC `/feature-dev` design step + orch-pipeline | `commands/feature-dev.md` Phase 4, `skills/orch-pipeline/SKILL.md:67`, plan-orchestrate catalogue `:62` + `design` tag `:129` | ✅ covered | none — parity achieved; `/feature-dev` ported as pi command (post-M3) |

## Agent content drift (record-only; sync is out of PRD scope)

All 25 same-name agents differ between ECC and hkx (expected: hkx files are pi-adapted).
`python-build-resolver` has no ECC same-name counterpart (hkx-native).

| agent | ECC lines / hkx lines | agent | ECC lines / hkx lines |
|---|---|---|---|
| agent-evaluator | 206 / 232 | harness-optimizer | 44 / 60 |
| architect | 220 / 63 | loop-operator | 45 / 61 |
| build-error-resolver | 123 / 144 | planner | 221 / 63 |
| code-architect | 80 / 95 | pr-test-analyzer | 54 / 86 |
| code-explorer | 78 / 93 | python-reviewer | 107 / 130 |
| code-reviewer | 323 / 112 | refactor-cleaner | 94 / 70 |
| conversation-analyzer | 61 / 95 | rust-build-resolver | 157 / 177 |
| database-reviewer | 100 / 61 | rust-reviewer | 103 / 130 |
| doc-updater | 116 / 79 | security-reviewer | 117 / 84 |
| docs-lookup | 77 / 52 | silent-failure-hunter | 59 / 96 |
| e2e-runner | 116 / 59 | tdd-guide | 100 / 64 |
| go-build-resolver | 103 / 130 | typescript-reviewer | 124 / 148 |
| go-reviewer | 85 / 115 | | |

## M2 scope-lock resolutions (implemented this milestone)

1. **`commands/e2e.md` thin entrance — ✅ DONE.** Mirrors `commands/multi-workflow.md`;routes to `hkx.e2e-runner` + `e2e-testing` skill.
2. **Add `code-architect` to plan-orchestrate — ✅ DONE.** Catalogue `:62` + `design` tag `:129` → `planner,architect,code-architect`.
3. **`documentation-lookup` ↔ `docs-lookup` cross-ref — ✅ DONE.** Pair With bullet naming the `docs-lookup` agent.
4. **Port `/feature-dev` — DONE (post-M3).** Ported as `commands/feature-dev.md`, a standard pi command delegating to the existing `hkx.code-explorer` / `hkx.code-architect` / `hkx.code-reviewer` / `hkx.security-reviewer` agents; no orchestration chains required.

## Full 26/26 agent entrance coverage (R5 evidence)

Every shipped agent has at least one entrance of type chain / command / skill.

| agent | chains | commands | skills |
|---|---|---|---|
| agent-evaluator | adversarial-review, go/python/rust/pr-review, security-scan | — | agent-self-evaluation |
| architect | — | — | code-tour, council, orch-pipeline, plan-orchestrate |
| build-error-resolver | typescript-build-fix | orch-fix-defect:19 | orch-fix-defect, orch-pipeline, plan-orchestrate |
| code-architect | — | — | orch-pipeline |
| code-explorer | docs-update, feature-flow, fix-defect, refactor-flow | multi-workflow:90, orch-fix-defect:16 | orch-fix-defect, orch-pipeline, plan-orchestrate |
| code-reviewer | 11 chains incl. adversarial-review, security-scan | blueprint:23, orch-review:37, review-pr:37, santa-loop:42 | blueprint, council, orch-pipeline, orch-review, plan-orchestrate, santa-method |
| conversation-analyzer | — | hookify:34, hookify-help:19 | — |
| database-reviewer | — | — | plan-orchestrate, postgres-patterns, redis-patterns |
| doc-updater | docs-update | — | plan-orchestrate |
| docs-lookup | — | — | plan-orchestrate |
| e2e-runner | — | — | plan-orchestrate |
| go-build-resolver | go-build-fix | orch-fix-defect:19 | plan-orchestrate |
| go-reviewer | go-build-fix, go-review | orch-review:38 | orch-pipeline, orch-review, plan-orchestrate |
| harness-optimizer | — | harness-audit:37 | plan-orchestrate |
| loop-operator | — | loop-start:41, loop-status:35 | plan-orchestrate |
| planner | feature-flow, fix-defect, refactor-flow | blueprint:23, multi-workflow:90 | blueprint, council, orch-change-feature, orch-pipeline, plan-orchestrate |
| pr-test-analyzer | adversarial-review, feature-flow, fix-defect, go/python/rust-review, pr-review, refactor-flow | review-pr:39 | — |
| python-build-resolver | python-build-fix | orch-fix-defect:19 | plan-orchestrate |
| python-reviewer | python-build-fix, python-review | orch-review:38 | orch-pipeline, orch-review, plan-orchestrate |
| refactor-cleaner | refactor-flow | orch-refine-code:21 | orch-refine-code, plan-orchestrate |
| rust-build-resolver | rust-build-fix | orch-fix-defect:19 | plan-orchestrate |
| rust-reviewer | rust-build-fix, rust-review | orch-review:38 | orch-pipeline, orch-review, plan-orchestrate |
| security-reviewer | adversarial-review, feature-flow, go/python/rust/pr-review, security-scan | orch-add-feature:20, orch-review:39, review-pr:38, santa-loop:42 | 9 skills incl. orch-pipeline, plan-orchestrate, santa-method |
| silent-failure-hunter | 11 chains incl. adversarial-review, security-scan | orch-review:40, review-pr:40 | orch-review |
| tdd-guide | feature-flow, fix-defect, python-build-fix | — | orch-pipeline, plan-orchestrate |
| typescript-reviewer | adversarial-review, typescript-build-fix | orch-review:38 | orch-pipeline, orch-review, plan-orchestrate |