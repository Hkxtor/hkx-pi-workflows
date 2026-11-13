# Command–Agent Map (hkx-pi-workflows)

**Status**: active. This is the operator-facing map of how each agent in `agents/` is entered (command / skill), the differences vs the upstream ECC map, and the unported items.

- Upstream authority: ECC `docs/COMMAND-AGENT-MAP.md`
- Implementation trail: `docs/command-agent-map-checklist.md` (M1/M2 audit, frozen)
- PRD: `.pi/prds/port-command-agent-map.prd.md` (closed at M3)

## Command → Agent (direct invocation)

These agents are entered directly through a command rather than an orchestration skill.

| Agent | Entrance | Where |
|---|---|---|
| `e2e-runner` | `/e2e` | `commands/e2e.md` (thin entrance → `hkx.e2e-runner` + `e2e-testing` skill); also catalogue `:69` + `test` tag `:132` |
| ~~`harness-optimizer`~~ | folded | harness revision runs in the main session via skill `agent-harness-construction` ("Improving an existing harness"); `/harness-audit` remains the operator entrance |
| ~~`database-reviewer`~~ | folded | schema/migration review runs in the main session via skill `database-migrations` (ordered Review Checklist); `postgres-patterns` / `redis-patterns` stay as the reference lane |
| ~~`docs-lookup`~~ | folded | absorbed into skill `documentation-lookup` (docs MCP tools + web search + lookup budget); removed from the agent catalogue |
| ~~`conversation-analyzer`~~ | folded | no-args `/hookify` analyzes in the main session via skill `hookify-rules` conversation-analysis section |

## Orchestration Routes

Multi-agent sequences are owned by the `orch-*` skills (engine: `orch-pipeline`). There are
no packaged chain files: pi-subagents removed durable chain definitions. Agents joined with
`+` run in parallel; `→` marks a handoff.

| Operation | Command | Agent sequence |
|---|---|---|
| review | `/orch-review` | `code-reviewer` + language reviewer → conditional `security-reviewer` / `silent-failure-hunter` |
| feature | `/orch-add-feature` | `code-explorer` → `tdd-guide` (in-step planning) → `code-reviewer` + `security-reviewer` + `pr-test-analyzer` |
| change | `/orch-change-feature` | same shape as feature; the first move amends the existing test |
| mvp | `/orch-build-mvp` | same shape as feature, applied per vertical slice |
| fix | `/orch-fix-defect` | `code-explorer` → `tdd-guide` (regression-first) → `code-reviewer` + `silent-failure-hunter` + `pr-test-analyzer` |
| refactor | `/orch-refine-code` | `code-explorer` → `refactor-cleaner` (in-step planning) → `code-reviewer` + `pr-test-analyzer` |
| gan pass | `/gan-build` | `gan-generator` → `gan-evaluator` (one pass; the loop and its stop decision stay in the main session) |
| build fix | `/build-fix` | `build-error-resolver` / `python-build-resolver` / `go-build-resolver` / `rust-build-resolver`, then the review fan-out |
| adversarial review | `/santa-loop` | two independent adversaries until they converge |

For an unattended end-to-end sequence, use a pi-subagents workflow script
(`subagent({ workflow: true })`, `runs.run`) instead of a packaged chain.

## Differences vs ECC

| ECC map entry | hkx behavior |
|---|---|
| `/multi-workflow` / `/multi-plan` / `/multi-execute` / `/multi-backend` / `/multi-frontend` → architect (+ Codex/Gemini external prompts) | merged into single thin router `commands/multi-workflow.md` — in-process pi-subagents only, no external `codeagent-wrapper` / `ccg-workflow` |
| `/e2e` → e2e-runner | upstream moved to `legacy-command-shims`; hkx ships a fresh thin `commands/e2e.md` routing to `hkx.e2e-runner` + `e2e-testing` skill |
| `/harness-audit` — "no single agent" | hkx keeps the command and now runs the revision workflow in the main session via skill `agent-harness-construction` (baseline scorecard → 1–3 leverage changes → verify), so the audit is agentless as upstream intended |
| `conversation-analyzer` absent from ECC map rows | folded (2026-10): no-args `/hookify` now analyzes in the main session via skill `hookify-rules`; the agent file was removed |
| 26 shared agent files, ECC↔hkx all differ | expected: hkx agents are Pi-adapted rewrites; content drift is record-only (see checklist), sync is a separate scope |

## Unported / Deferred

| Item | Decision | Reason |
|---|---|---|
| `/feature-dev` command | ported | `commands/feature-dev.md` — standard pi command: `hkx.code-explorer` recon, in-session Phase 4 design (folded code-architect blueprint), `hkx.code-reviewer` (+ `hkx.security-reviewer` for sensitive changes); no orchestration skill required |
| `/multi-plan` / `/multi-execute` / `/multi-backend` / `/multi-frontend` as separate commands | not ported | folded into `commands/multi-workflow.md` modes; separate commands would duplicate the thin router |
| ECC `/orchestrate` as a command | not ported | superseded by `skills/orch-pipeline` + `commands/hkx-orch-*` family |
| ECC `change-impact` skill | ported | `skills/change-impact` — free-standing PRD/ADR location names replaced with "write only where the project already defines a location" |
| ECC `contract-first` skill | ported | `skills/contract-first` — complements `api-design` (shape of a good API) by governing how a boundary changes |
| ECC `rules-distill` skill | ported | `skills/rules-distill` — `~/.claude/skills/...` scan scripts replaced with in-repo `find`/`ffgrep`; targets hkx `rules/` and the `hkx-rules` extension |
| ECC `gan-style-harness` + `gan-planner`/`gan-generator`/`gan-evaluator` agents | ported, planner folded | `skills/gan-style-harness` + `hkx.gan-generator` (writer) + `hkx.gan-evaluator` (read-only); `/gan-build` drives the pass. `gan-planner` has no agent: the spec is written by the main loop, per the fold rule. Evaluator drives the app through `bash` because pi exposes no browser tool to children |

## Agent Entrance Coverage

Every shipped agent has at least one entrance of type command / skill. Command/skill columns list file-level entrances. (Fold migration 2026-10: `docs-lookup`, `conversation-analyzer`, `loop-operator`, `database-reviewer`, and `harness-optimizer` folded into skills; the planner/architect/code-architect consolidation is recorded in the migration batches.)

| Agent | Commands | Skills |
|---|---|---|
| agent-evaluator | — | agent-self-evaluation |
| build-error-resolver | build-fix, orch-fix-defect | orch-fix-defect, orch-pipeline, plan-orchestrate |
| code-explorer | multi-workflow, orch-add-feature, orch-build-mvp, orch-change-feature, orch-fix-defect, orch-refine-code | orch-fix-defect, orch-pipeline, plan-orchestrate |
| code-reviewer | blueprint, orch-review, review-pr, santa-loop | blueprint, council, orch-pipeline, orch-review, plan-orchestrate, santa-method |
| doc-updater | — | plan-orchestrate |
| e2e-runner | e2e | plan-orchestrate |
| go-build-resolver | build-fix, orch-fix-defect | plan-orchestrate |
| go-reviewer | orch-review | orch-pipeline, orch-review, plan-orchestrate |
| gan-evaluator | gan-build | gan-style-harness |
| gan-generator | gan-build | gan-style-harness |
| pr-test-analyzer | orch-add-feature, orch-build-mvp, orch-change-feature, orch-fix-defect, orch-refine-code, review-pr | — |
| python-build-resolver | build-fix, orch-fix-defect | plan-orchestrate |
| python-reviewer | orch-review | orch-pipeline, orch-review, plan-orchestrate |
| refactor-cleaner | orch-refine-code | orch-refine-code, plan-orchestrate |
| rust-build-resolver | build-fix, orch-fix-defect | plan-orchestrate |
| rust-reviewer | orch-review | orch-pipeline, orch-review, plan-orchestrate |
| security-reviewer | orch-add-feature, orch-review, review-pr, santa-loop | orch-pipeline, plan-orchestrate, santa-method, +6 more |
| silent-failure-hunter | orch-fix-defect, orch-review, review-pr | orch-review |
| tdd-guide | orch-add-feature, orch-build-mvp, orch-change-feature, orch-fix-defect | orch-pipeline, plan-orchestrate |
| typescript-reviewer | orch-review | orch-pipeline, orch-review, plan-orchestrate |

**Verification**: `docs/command-agent-map-checklist.md` holds the grep-verified script that confirmed all 26 rows at M3 (`26/26 PASS`); after the 2026-10 fold migration the live table above is authoritative (20 rows).