---
name: multi-workflow
description: "Pi-native multi-workflow router — map ECC multi-* intents to existing chains, orch skills, and commands (no external ccg-workflow)."
argument-hint: "[plan|execute|backend|frontend|review|fix|refactor|docs] [task description]"
---

# /multi-workflow — Multi-Workflow Router

> ECC `multi-workflow` / `multi-plan` / `multi-execute` / `multi-backend` / `multi-frontend` 的 **pi-native 薄入口**。
> **不**依赖 `npx ccg-workflow`、`codeagent-wrapper`、Codex/Gemini 外挂或 `~/.claude/.ccg`。
> 编排落在 **现有** commands / orch skills / `chains/*.chain.json`（pi-subagents）。

## GateGuard (create)

1. Loaded via `package.json` `pi.prompts` → `./commands`; Path B install links `commands/` + `prompts/`.
2. Surfaces: slash router only; delegates to existing `workflow`, orch skills, and chains — no new runtime code.
3. Args: optional mode keyword + free-text task; chain names match `chains/hkx-*.chain.json`.
4. Auth: user "做 multi-workflow 薄命令 + 现有 chains 映射".
5. Verify: `npm run validate`; routing table review (prompt-only, no unit test required).

**Input**: `$ARGUMENTS`

---

## Operating rules (vs ECC multi-*)

| ECC multi-* | This command |
| --- | --- |
| External `codeagent-wrapper` + Codex/Gemini | **In-process** pi-subagents agents/chains |
| Parallel `run_in_background` + `TaskOutput` | pi-subagents parallel steps / parent waits for children |
| External models may propose diffs only | Same spirit: **main session is the only writer** for production code |
| Session IDs + `resume` across phases | Stateless per chain run; pass plan artifacts explicitly |
| Requires `npx ccg-workflow` | **No** extra runtime |

Always:

1. Keep the **main session as sole writer** of the active worktree.
2. Prefer packaged **chains** for repeatable multi-agent sequences; use **orch skills** when human gates (plan approve / commit) matter.
3. Do **not** shell out to `~/.claude/bin/codeagent-wrapper` or invent a second multi-model CLI.
4. If `$ARGUMENTS` is empty, ask for mode + task before routing.

---

## Phase 0 — Parse mode

Split `$ARGUMENTS` into **mode** (optional first token) and **task** (remainder).

| First token (case-insensitive) | Mode |
| --- | --- |
| `plan` / `planning` | **plan** |
| `execute` / `impl` / `implement` | **execute** |
| `backend` / `api` / `server` | **backend** |
| `frontend` / `ui` / `ux` | **frontend** |
| `review` / `pr-review` / `adversarial` | **review** |
| `fix` / `bug` / `defect` | **fix** |
| `refactor` / `clean` | **refactor** |
| `docs` / `codemap` | **docs** |
| `build` / `build-fix` / `typefix` | **build-fix** |
| `security` / `sec` | **security** |
| `full` / `workflow` / *(missing)* | **full** (default) |

If the first token is **not** a mode keyword, treat the **entire** `$ARGUMENTS` as the task and use mode **full**.

Detect language hints in the task text (`TypeScript` / `Go` / `Rust` / `Python` / …) only to pick language-specific **review** or **build-fix** chains when mode is `review` or `build-fix`.

---

## Routing table (ECC → hkx)

### A. Full multi-workflow (ECC `/multi-workflow`)

**Mode `full`**

Default path — single-session orchestrator (same 6 phases as `workflow`):

1. Follow **`/workflow`** phases: Research → Ideation → Plan → Execute → Verify → Review for **task**.
2. When the task is clearly a **net-new feature** and the user wants multi-agent explore/plan/TDD/review, prefer:
   - Skill/command: **`orch-add-feature`** (human gates), **or**
   - Chain: **`hkx-feature-flow`** via pi-subagents (`explore → plan → tdd → parallel review`).
3. After implementation, optional stronger review: chain **`hkx-adversarial-review`** or command **`/orch-review`** / **`/santa-loop`**.

Do **not** re-implement the six phases inline if you can invoke `/workflow` or the chain/skill above.

### B. Plan only (ECC `/multi-plan`)

**Mode `plan`**

- **No production code edits.**
- Use **`/hkx-plan`** (or **`/blueprint`** for multi-session construction, **`/hkx-plan-prd`** for PRD-shaped work).
- Optional read-only agents: `hkx.code-explorer`, `hkx.planner` (or run only the research/plan prefix of a delivery flow and stop).
- Write plan artifacts under `.pi/plans/` or the path the user names.
- Present the plan and **wait for explicit approval** before any execute mode.

### C. Execute from plan (ECC `/multi-execute`)

**Mode `execute`**

Prerequisite: an approved plan in `$ARGUMENTS`, conversation, or a path the user names. If missing, run **plan** mode first or ask.

- Sole writer: main session (or the single writer agent inside a chain’s implementation step).
- Prefer by intent:
  - **`orch-add-feature`** / **`orch-change-feature`** / **`orch-fix-defect`** / **`orch-refine-code`**, **or**
  - Chain **`hkx-feature-flow`** / **`hkx-fix-defect`** / **`hkx-refactor-flow`**.
- Treat external or prior agent diffs as **dirty prototypes**: refactor to match local style before commit.
- Finish with verify + **`/orch-review`** or chain **`hkx-pr-review`**.

### D. Backend-focused (ECC `/multi-backend`)

**Mode `backend`**

Same as **full** / **execute**, with emphasis:

- API, data, algorithms, business logic, migrations.
- Skills: `backend-patterns`, language `*-workflow`, `api-design` as needed.
- Review: language chain if known (`hkx-go-review`, `hkx-rust-review`, `hkx-python-review`; TS via `hkx-pr-review` / typescript reviewer agents), else **`hkx-pr-review`** + **`security-scan`** when auth/data touched.
- Still **one writer**; use reviewers as advisors, not a second writer.

### E. Frontend-focused (ECC `/multi-frontend`)

**Mode `frontend`**

Same orchestration surfaces as **full**, with emphasis:

- Components, layout, interaction, a11y, visual polish.
- Skills: `frontend-patterns`, `frontend-design-direction`, `make-interfaces-feel-better`, `accessibility` as needed.
- Review: **`hkx-pr-review`** / **`hkx-adversarial-review`**.
- There is **no** separate “Gemini frontend model” in-core — do not invent external UI model wrappers.

### F. Review / fix / refactor / docs / build / security

| Mode | Primary surface |
| --- | --- |
| **review** | `/orch-review` or chains `hkx-pr-review` / `hkx-adversarial-review` (+ language `hkx-*-review` when dominant language is clear) |
| **fix** | `/orch-fix-defect` or chain `hkx-fix-defect` |
| **refactor** | `/orch-refine-code` or chain `hkx-refactor-flow` |
| **docs** | `/update-docs` or chain `hkx-docs-update` |
| **build-fix** | `/build-fix` or chains `hkx-build-fix` / `hkx-typescript-build-fix` / `hkx-go-build-fix` / `hkx-rust-build-fix` / `hkx-python-build-fix` |
| **security** | `/security-scan` or chain `hkx-security-scan` |

---

## Chain catalog (quick map)

Delivery:

- `hkx-feature-flow` — net-new feature
- `hkx-fix-defect` — bug fix
- `hkx-refactor-flow` — behavior-preserving clean
- `hkx-docs-update` — docs/codemaps

Review:

- `hkx-pr-review`, `hkx-adversarial-review`, `hkx-security-scan`
- `hkx-go-review`, `hkx-python-review`, `hkx-rust-review`

Build recovery:

- `hkx-build-fix`, `hkx-typescript-build-fix`, `hkx-go-build-fix`, `hkx-rust-build-fix`, `hkx-python-build-fix`

How to run a chain when pi-subagents is available: use the host’s chain runner / subagent tool with the chain name above and `task` = the user task. If chains are unavailable, fall back to the mapped **command/skill** in the same row and say so.

---

## Phase 1 — Dispatch

1. Announce: `[Mode: <mode>]` and the **chosen surface** (command / skill / chain name).
2. Restate the task in one line.
3. Execute **only** that surface (do not fan out every chain).
4. If multiple surfaces fit, pick **one** primary; mention alternates in one line.

## Phase 2 — Complete

Return:

- Mode + routed target
- What ran (commands, agents, chain id)
- Artifacts / plan paths
- Validation (if any)
- Next step (e.g. `execute` after `plan`, or `/prp-pr`)

---

## Examples

| You say | Routes to |
| --- | --- |
| `/multi-workflow add rate limiting to the API` | **full** → `/workflow` or `hkx-feature-flow` / orch-add-feature |
| `/multi-workflow plan migrate sessions to redis` | **plan** → `/hkx-plan` (no code) |
| `/multi-workflow execute` + approved plan | **execute** → orch / feature-flow |
| `/multi-workflow backend harden auth cookies` | **backend** → feature/security-aware path |
| `/multi-workflow frontend polish settings form a11y` | **frontend** → feature-flow + frontend skills |
| `/multi-workflow review` | **review** → orch-review / pr-review chain |
| `/multi-workflow fix flaky payment webhook test` | **fix** → orch-fix-defect / fix-defect chain |

## Related

- `/workflow` — in-session 6-phase without mandatory multi-agent fan-out
- `/recipes` — browse/match command families (advisory)
- `/hkx-model-route` — model selection hints (not external wrappers)
- Skills: `parallel-execution-optimizer`, `orch-pipeline`, language `*-workflow`
