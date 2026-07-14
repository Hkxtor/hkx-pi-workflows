---
name: hkx-orch-pipeline
description: Shared orchestration engine for the hkx-orch-* skill family. Defines the gated Research-Plan-TDD-Review-Commit pipeline, the size classifier, the agent map, and the two human gates that the operation skills delegate to. Not usually invoked directly.
origin: HKX-converted-for-Pi
---

# HKX Orchestrator Pipeline (shared engine)

The `hkx-orch-*` skills are thin wrappers. They classify the request, choose which phases of this pipeline run, and delegate each phase to an existing Pi agent or command. This file is that pipeline.

> Invoke an operation skill (`hkx-orch-add-feature`, `hkx-orch-fix-defect`, …) rather than this engine directly.

## When to Use

- Loaded indirectly whenever an `hkx-orch-*` operation skill runs.
- Read directly only when adding a new operation to the family or tuning the shared phases, gates, or agent map.

## The Operation Family

| Skill | Operation | Trigger | First move |
|---|---|---|---|
| `hkx-orch-add-feature` | feature | capability does not exist yet | research + plan a new slice |
| `hkx-orch-change-feature` | tweak | works, but desired behavior differs | amend existing behavior and its tests |
| `hkx-orch-fix-defect` | fix | broken; behavior is wrong | reproduce as a failing test, then fix |
| `hkx-orch-refine-code` | refactor | behavior stays, structure improves | restructure while keeping tests green |
| `hkx-orch-build-mvp` | mvp | bootstrap from a design/spec doc | ingest doc → vertical slices |

## Step 0 — Classify Size (right-sizing)

Ceremony scales to blast radius. Score the request on three signals, take the **highest** tier any signal reaches, and state the result in one line so the user can override:

| Tier | Files touched | New dependency / contract | Design ambiguity | Phases that run |
|---|---|---|---|---|
| trivial | 1, a few lines | none | none — the change is obvious | 4 → 5 → 6 |
| small | 1 file / 1 function | none | clear once you read the code | (1 light) → 4 → 5 → 6 |
| standard | 2–5 files | maybe a new internal module | one real choice to make | 1 → 2 → 4 → 5 → 6 |
| large | many / cross-cutting | new external dep, public API, or a spec doc | multiple open questions | 1 → 2 → (3) → 4 → 5 → 6 |

Phase 0 (Intake) always runs. Tie-breaker: anything touching a security trigger or a public API / contract is **at least** standard, regardless of file count.

## The Phases

Each phase delegates — it does not do the work inline.

- **0. Intake** — restate the request. For `hkx-orch-build-mvp`, read the spec/design doc and extract scope, locked decisions, and a feature list.
- **1. Research & Reuse** — use `find` / `search` / `read` for local code, then docs lookup via configured MCP tools, then package registries. Prefer adopting a proven implementation over net-new code.
- **2. Plan** — delegate to the `planner` agent. Output a `task_list` ordered as thin vertical slices. → **GATE 1.**
- **3. Scaffold** — `hkx-orch-build-mvp` only: stand up the first end-to-end slice.
- **4. Implement (TDD)** — drive each task through the `tdd-guide` agent (or the `tdd-workflow` skill): red → green → refactor. Honor the operation's first-move rule.
- **5. Review** — `code-reviewer` agent. Add `security-reviewer` whenever the diff touches a security trigger.
- **6. Commit** — conventional commits (`feat:` / `fix:` / `refactor:` / …), one per logical chunk. → **GATE 2.**

## The Two Gates

This family is **gated, not autonomous**:

1. **GATE 1 — after Plan.** Present the `task_list`; do not write implementation code until the user approves.
2. **GATE 2 — before Commit.** Present the diff summary and proposed messages; do not commit until the user confirms.

Everything between the gates flows without stopping.

## Agent / Command Map

| Phase | Primary | Fallback / escalation |
|---|---|---|
| Intake / understand | `code-explorer` | trace existing paths before a tweak, fix, or refactor |
| Plan | `planner` | `architect`, `code-architect` for structural calls |
| Implement | `tdd-guide` (or `tdd-workflow` skill) | `build-error-resolver` / `/hkx-build-fix` on build breaks |
| Review | `code-reviewer` / `/hkx-code-review` | language reviewer (`python-reviewer`, `typescript-reviewer`, `rust-reviewer`, `go-reviewer`) |
| Security | `security-reviewer` | — |

Match the language reviewer to the repo.

## Security-Review Trigger

Pull in `security-reviewer` when the diff touches any of: authentication or authorization, user-input handling, database queries, file-system paths, external API calls, cryptography, or secrets / credentials.

## Handoff Artifacts

The pipeline carries no hidden state — the planning docs are the handoff:

- `task_list` (from Plan) drives the Implement loop.
- Larger work may also emit PRD / architecture / system_design under `.pi/prds/` or `docs/`.
- Review findings (CRITICAL / HIGH) must be resolved before Gate 2.

## Verification

- Size tier was stated and matched the work
- Gate 1 (plan) and Gate 2 (commit) were both honored
- `security-reviewer` ran iff a security trigger was touched
- Commits are conventional and scoped to one logical change
- New / changed behavior has tests; coverage ≥ 80% per `rules/hkx-common-testing.md`
