---
name: orch-pipeline
description: Shared orchestration engine for the hkx-orch-* skill family. Defines the gated Research-Plan-TDD-Review-Commit pipeline, the size classifier, the agent map, and the two human gates that the operation skills delegate to. Not usually invoked directly.
origin: HKX-converted-for-Pi
---

# HKX Orchestrator Pipeline (shared engine)

The `hkx-orch-*` skills are thin wrappers. They classify the request, choose which phases of this pipeline run, and delegate each phase to an existing Pi agent or command. This file is that pipeline.

> Invoke an operation skill (`orch-add-feature`, `orch-fix-defect`, …) rather than this engine directly.

## When to Use

- Loaded indirectly whenever an `hkx-orch-*` operation skill runs.
- Read directly only when adding a new operation to the family or tuning the shared phases, gates, or agent map.

## The Operation Family

| Skill | Operation | Trigger | First move |
|---|---|---|---|
| `orch-add-feature` | feature | capability does not exist yet | research + plan a new slice |
| `orch-change-feature` | tweak | works, but desired behavior differs | amend existing behavior and its tests |
| `orch-fix-defect` | fix | broken; behavior is wrong | reproduce as a failing test, then fix |
| `orch-refine-code` | refactor | behavior stays, structure improves | restructure while keeping tests green |
| `orch-build-mvp` | mvp | bootstrap from a design/spec doc | ingest doc → vertical slices |

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

- **0. Intake** — restate the request. For `orch-build-mvp`, read the spec/design doc and extract scope, locked decisions, and a feature list.
- **1. Research & Reuse** — use `find` / `search` / `read` for local code, then docs lookup via configured MCP tools, then package registries. Prefer adopting a proven implementation over net-new code.
- **2. Plan** — run `/hkx-plan` in the main session (step quality, sizing/phasing, validation order). Output a `task_list` ordered as thin vertical slices. → **GATE 1.**
- **3. Scaffold** — `orch-build-mvp` only: stand up the first end-to-end slice.
- **4. Implement (TDD)** — drive each task through the implementing agent named by the
  **backing chain** (`tdd-guide` for feature / change / fix / mvp, `refactor-cleaner` for
  refine): red → green → refactor. Honor the operation's first-move rule.
- **5. Review** — the review fan-out the backing chain defines (`code-reviewer` always,
  plus `security-reviewer`, `pr-test-analyzer`, `silent-failure-hunter`, or a language
  reviewer where that chain includes them). Add `security-reviewer` whenever the diff
  touches a security trigger even if the chain omits it.
- **6. Commit** — conventional commits (`feat:` / `fix:` / `refactor:` / …), one per logical chunk. → **GATE 2.**

## The Two Gates

This family is **gated, not autonomous**:

1. **GATE 1 — after Plan.** Present the `task_list`; do not write implementation code until the user approves.
2. **GATE 2 — before Commit.** Present the diff summary and proposed messages; do not commit until the user confirms.

Everything between the gates flows without stopping.

## Backing Chains — who owns the execution shape

**The packaged chain owns the agent sequence; this engine owns the policy around it.**

That split exists because the same shape (explore → implement → review) is reachable two
ways, and encoding the agent list twice is how the two copies drift apart. A concrete
example of that drift, caught when this rule was written: this file used to say
Implement → `tdd-guide` for every operation, while `orch-refine-code` correctly used
`refactor-cleaner` — the chain had it right, the engine did not.

| Operation skill | Backing chain | Shape the chain encodes |
|---|---|---|
| `orch-add-feature` | `hkx-feature-flow` | explore → tdd-guide → review fan-out |
| `orch-change-feature` | `hkx-feature-flow` | same shape, different first move (amend the existing test) |
| `orch-fix-defect` | `hkx-fix-defect` | explore → tdd-guide → review + silent-failure-hunter |
| `orch-refine-code` | `hkx-refactor-flow` | explore → refactor-cleaner → review |
| `orch-build-mvp` | `hkx-feature-flow` | same shape, applied per vertical slice |
| `orch-review` | `hkx-pr-review` | reviewer fan-out only, no implementation step |

What each layer owns:

| This engine (`orch-pipeline`) | The backing chain |
|---|---|
| Size classification | Which agents run |
| Phase mask per operation | Their order |
| First-move rule per operation | Handoff artifacts between steps |
| **GATE 1 / GATE 2** | The task prompt each agent receives |
| Security trigger | Parallel fan-out shape |

Because the chain is the source, an operation skill declares its `backing-chain` in
frontmatter and names only agents the chain actually contains. `scripts/validate.mjs`
enforces both: a declared chain must exist, and an operation skill that names an agent
outside its chain must list it under `fallback-agents` (escalations such as
`build-error-resolver` on a build break). Drift then fails validation instead of
silently producing two different pipelines.

### Reading the chain instead of restating it

When a gated run needs the sequence, read `chains/<backing-chain>.chain.json` — each step
carries `agent`, `phase`, `label`, `output`, and `task`. Replay the steps **one at a time
in this session**, inserting the gates between phases. Do not hand the whole chain to
pi-subagents: a packaged chain runs to completion and cannot stop at Gate 1.

That is the whole difference between the two lanes — same steps, gates on or off.

## Main-Session and Escalation Map

Steps that are not part of any chain, because they are planning or recovery rather than
execution:

| Phase | Primary | Fallback / escalation |
|---|---|---|
| Intake / understand | `code-explorer` (or its `mine` mode for a spec-less module) | trace existing paths before a tweak, fix, or refactor |
| Plan | `/hkx-plan` (main session) | design skills (`hexagonal-architecture`, `api-design`) for structural calls |
| Build break | — | `build-error-resolver` / `/build-fix` |
| Docs touch | — | `doc-updater` |

Match the language reviewer to the repo — the review chains already do this per language.

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
