---
name: hkx-plan-orchestrate
description: Read a plan document, decompose it into steps, design a per-step agent chain from the Pi catalogue, and emit ready-to-use task agent invocations. Generative only — never executes the tasks itself. Use when the user has a multi-step plan and wants to drive it through orchestrated agents without composing chains by hand.
origin: HKX-converted-for-Pi
---

# HKX Plan Orchestrate For Pi

Bridge a plan document to Pi `task` agent invocations by emitting one
ready-to-use call per step. The skill is generative only — it never executes the
tasks. The user invokes each step when ready.

## When to Activate

- User has a multi-step plan document (PRD, RFC, implementation plan) and wants
  to drive it through orchestrated agents.
- User says "orchestrate this plan", "give me agent prompts for each step",
  "compose chains for this plan".
- A step-by-step plan exists but the user does not want to manually pick agents
  per step.

Skip when:

- The work is one ad-hoc step → call the appropriate agent directly.
- The plan is unreadable or empty. Lack of explicit numbering alone is not a
  skip condition — see the "No clear steps" edge case below.

## Inputs

```
<plan-doc-path> [--lang=python|typescript|go|rust|cpp|java|kotlin|flutter|auto] [--scope=all|step:<n>|range:<a>-<b>] [--dry-run]
```

- `<plan-doc-path>` — required; relative or absolute path.
- `--lang` — reviewer language variant; defaults to `auto` (detected from
  project).
- `--scope` — limits emitted steps; defaults to `all`.
- `--dry-run` — print decomposition + chain rationale only; do not emit final
  prompts.

## Pi Task Invocation Shape

Each step emits a `task` agent invocation:

```
task(agent="<agent-name>", context="<shared context>", assignment="<task description>")
```

- Agent names come from the catalogue below.
- `context` carries shared background (plan path, step id, constraints).
- `assignment` is self-contained per-step instructions.

For multi-agent chains, emit sequential `task` calls where each builds on the
previous output. Use `parallel` when steps are independent.

## Available Agent Catalogue (must pick from these)

General:

- `planner` — requirement restatement, risk decomposition, step planning
- `architect` — architecture, system design, refactor proposals
- `tdd-guide` — write tests → implement → 80%+ coverage
- `code-reviewer` — generic code review
- `security-reviewer` — security audit, OWASP, secret leakage
- `refactor-cleaner` — dead code, duplicates, knip-class cleanup
- `doc-updater` — documentation, codemap, README
- `docs-lookup` — third-party library API lookups (Context7)
- `e2e-runner` — end-to-end test orchestration
- `database-reviewer` — PostgreSQL schema, migration, performance
- `harness-optimizer` — local agent harness configuration
- `loop-operator` — long-running autonomous loops
- `code-explorer` — codebase investigation and tracing

Build error resolvers:

- `build-error-resolver` (generic)
- `cpp-build-resolver` / `go-build-resolver` / `java-build-resolver` /
  `kotlin-build-resolver` / `rust-build-resolver` / `pytorch-build-resolver`

Code reviewers:

- `python-reviewer` / `typescript-reviewer` / `go-reviewer` / `rust-reviewer` /
  `cpp-reviewer` / `java-reviewer` / `kotlin-reviewer` / `flutter-reviewer`

A misspelled agent name fails invocation. Cross-check against this list before
emitting.

## How It Works

### Phase 0 — Detect Language

1. Read `<plan-doc-path>`. If missing or empty, report and stop.
2. Resolve `--lang`. When `auto`, run a polyglot-aware detection:
   - Probe markers: `pyproject.toml` / `uv.lock` / `requirements.txt` → python;
     `package.json` → typescript; `go.mod` → go; `Cargo.toml` → rust;
     `CMakeLists.txt` or top-level `*.cpp` → cpp; `pom.xml` / `build.gradle`
     (Java) → java; `build.gradle.kts` or top-level Kotlin → kotlin;
     `pubspec.yaml` → flutter.
   - **Polyglot tie-break**: if more than one marker matches, pick the language
     whose source files outnumber the others (count via `git ls-files`,
     excluding `vendor/`, `node_modules/`, `dist/`, `build/`, `.venv/`,
     generated files, and obvious test fixtures). On a tie or when no language
     exceeds 60% of source files, set `lang=unknown`.
   - No marker matched → set `lang=unknown`.
   - `lang=unknown` is a sentinel — it is **not** an agent name. Phase 2 rules
     turn it into `code-reviewer` / `build-error-resolver` at chain composition
     time.
3. Detect a **PyTorch sub-profile**: when `lang=python` and any of
   `pyproject.toml` / `requirements.txt` / `uv.lock` declares a dependency on
   `torch`, set `pytorch=true`. This only affects `build` chain selection; the
   reviewer remains `python-reviewer`.
4. **Normalize any agent names declared in the plan**: strip any prefix before
   validating against the catalogue.

### Phase 1 — Decompose Steps

Identify "step units" in priority order:

1. Explicit numbering: `## Step N` / `### Phase N` / `## N. ...` / top-level
   ordered list.
2. A "Step" column in a table.
3. `---`-separated blocks with verb-led headings.
4. Otherwise treat each H2 as one step.

Per step extract `id` (1-based), `title` (≤ 80 chars), `intent` (1–3
sentences), `tags`.

### Phase 2 — Tag and Pick Chain

Tag by intent (multi-tag allowed; chain built from primary + stacked
secondaries):

Trigger words below are matched case-insensitively.

| Tag | Trigger words | Default chain |
|---|---|---|
| `design` | architecture, design, choose, evaluate, RFC | `planner,architect` |
| `plan` | plan, breakdown, milestone | `planner` |
| `impl` | implement, build, add, create, port | `tdd-guide,<lang>-reviewer` |
| `test` | test, coverage, e2e, integration | `tdd-guide,e2e-runner` |
| `refactor` | refactor, cleanup, dedupe, split | `architect,refactor-cleaner,<lang>-reviewer` |
| `migration` | migrate, upgrade, rewrite, port | `architect,tdd-guide,<lang>-reviewer` |
| `db` | schema, migration, index, SQL, Postgres, alembic, sqlmodel | `database-reviewer,<lang>-reviewer` |
| `security` | encrypt, auth, secret, OWASP, PII | `security-reviewer,<lang>-reviewer` |
| `build` | build, compile, lint failure, CI | `<lang>-build-resolver` (falls back to `build-error-resolver`) |
| `docs` | docs, readme, codemap, changelog | `doc-updater` |
| `lookup` | lookup, reference, API usage | `docs-lookup` |
| `review` | review, audit, verify | `<lang>-reviewer,code-reviewer` |
| `loop` | loop, autonomous, watchdog | `loop-operator` |

Chain composition rules:

1. **Primary tag selection**: when a step matches multiple tags, the **first one
   in table order** (top of the table = highest priority) is the primary; the
   rest are secondaries.
2. `impl` + `security` → `tdd-guide,<lang>-reviewer,security-reviewer`.
3. `impl` + `db` → `tdd-guide,database-reviewer,<lang>-reviewer`.
4. **Deduplicate** the resulting chain (preserve first occurrence).
5. `<lang>-reviewer` resolves to `code-reviewer` when `lang=unknown`.
6. `<lang>-build-resolver` resolves to `build-error-resolver` when
   `lang=unknown`. **Special case**: if Phase 0 set `pytorch=true`, use
   `pytorch-build-resolver` for `build` chains regardless of `<lang>`.
7. **Zero-tag steps**: if no trigger word matches, set chain to `code-reviewer`
   and write `no tag matched; default review-only chain` under "Chain
   rationale".
8. Chain length ≤ 4 after deduplication. If exceeded, drop weakest tag (`lookup`
   and `docs` first).
9. Do not pair `planner` and `architect` in an `impl` chain. Pair them only on
   `design` steps.
10. Steps tagged `impl`, `refactor`, or `migration` end with a **reviewer-class**
    agent. `test` and `build` steps are gated by their own validators and do not
    require an additional reviewer.

### Phase 3 — Compress Task Description

Each emitted `assignment` must:

- Be self-contained (the first agent does not need the plan document open).
- Start with `[Plan: <path>#step-<id>]`.
- Include 1–3 verifiable Acceptance criteria.
- Include a Scope guard (`Out of scope: ...`) **only if the plan declares one
  for this step**. Inherit verbatim. If the plan has no out-of-scope statement,
  omit the clause entirely — do not invent one.
- Be 200–600 characters; one line.

### Phase 4 — Output

Emit Markdown with the decomposed steps and ready-to-use agent invocations.

Output structure:

````markdown
# Plan-Orchestrate Result

**Plan**: `<path>`
**Lang**: `<detected-or-given>`
**Steps**: <N>
**Scope**: <all | step:n | range:a-b>

## Steps overview

| # | Title | Tags | Chain |
|---|---|---|---|
| 1 | ... | impl, db | `tdd-guide → database-reviewer → python-reviewer` |
| ... | | | |

---

## Step 1 — <title>

**Intent**: <1–3 sentences>
**Tags**: <a, b>
**Chain rationale**: <why this chain; which agent closes the loop>

### Agent 1: tdd-guide
```python
task(
    agent="tdd-guide",
    context="Plan: docs/foo.md, Step 1 of N. Language: python.",
    assignment="[Plan: docs/foo.md#step-1] <compressed task description>; Acceptance: <1–3 items>; Out of scope: <…>"
)
```

### Agent 2: database-reviewer
```python
task(
    agent="database-reviewer",
    context="Previous agent (tdd-guide) completed implementation. Review the database migration.",
    assignment="Review the database schema changes from step 1..."
)
```
````

For independent steps, emit a `parallel` block:

```markdown
## Steps 3-5 — Independent implementation

These steps can run in parallel:

```python
parallel([
    lambda: task(agent="tdd-guide", context="...", assignment="Step 3..."),
    lambda: task(agent="tdd-guide", context="...", assignment="Step 4..."),
    lambda: task(agent="tdd-guide", context="...", assignment="Step 5..."),
])
```
```

### Phase 5 — Self-check (run before emitting)

- [ ] Every agent in every chain comes from the catalogue.
- [ ] No invented flags or parameters.
- [ ] Each task description begins with `[Plan: <path>#step-<id>]` and includes
  Acceptance (1–3 items).
- [ ] No duplicate agent in any chain after Phase 2 dedup.
- [ ] Chain length ≤ 4.
- [ ] Steps tagged `impl`/`refactor`/`migration` end with a reviewer-class
  agent.
- [ ] Zero-tag steps emit `code-reviewer` with the rationale `no tag matched;
  default review-only chain`.
- [ ] Overview table lists every step in the plan, regardless of `--scope`.

## Edge Cases

- **No clear steps**: prefer H2/H3 splitting; if still ambiguous, report "no
  structured steps detected" with the document outline and ask the user to
  confirm running by outline.
- **Large plan (>1500 lines)**: enter **overview-only mode** — emit only the
  overview table and ask the user to narrow with `--scope` before re-running for
  details.
- **Step too broad** (e.g. "complete all backend work"): do not force a single
  chain. Suggest splitting into N.a and N.b and propose a split.
- **Plan declares agents**: validate against the catalogue. Replace invalid
  agents and explain under "Chain rationale".
- **Polyglot project where `--lang=auto` cannot pick a winner**: set
  `lang=unknown`; reviewer resolves to `code-reviewer` and build resolver to
  `build-error-resolver`. Mention the fallback under "Chain rationale".

## Examples

### Example 1 — Python plan

Input:
```
plan-orchestrate @docs/plan/example-feature.md --lang=python
```

Excerpt of expected output:

```markdown
## Step 2 — Encrypt sensitive UserProfile fields

**Intent**: Introduce an `EncryptedString` SQLAlchemy type and AES-GCM encrypt
`birth_datetime` / `location` before persistence; load the key from an
environment variable.
**Tags**: impl, security, db
**Chain rationale**: Security-sensitive write path, so `security-reviewer` closes
the chain; `database-reviewer` validates the alembic migration; `python-reviewer`
covers typing and PEP 8.

### Agent 1: tdd-guide
```python
task(
    agent="tdd-guide",
    context="Plan: docs/plan/example-feature.md, Step 2. Language: python. Security + DB migration.",
    assignment="[Plan: docs/plan/example-feature.md#step-2] Implement EncryptedString SQLAlchemy type and migrate UserProfile.birth_datetime/location columns; key from ENV APP_DB_KEY; Acceptance: encrypt/decrypt roundtrip tests pass; alembic upgrade/downgrade clean on empty DB; no plaintext in DB after migrate; Out of scope: cross-tenant profile sharing logic"
)
```

### Agent 2: database-reviewer
```python
task(
    agent="database-reviewer",
    context="Previous agent (tdd-guide) implemented EncryptedString type and migration. Review migration safety.",
    assignment="Review the alembic migration for step 2. Check: upgrade/downgrade symmetry, index preservation, data loss risks on existing rows."
)
```

### Agent 3: python-reviewer
```python
task(
    agent="python-reviewer",
    context="Previous agents implemented and reviewed the migration. Final code quality check.",
    assignment="Review the EncryptedString implementation for PEP 8, type hints, and Pythonic patterns. Ensure no key material leaks into logs or error messages."
)
```

### Agent 4: security-reviewer
```python
task(
    agent="security-reviewer",
    context="Previous agents completed implementation and code review. Final security audit.",
    assignment="Audit the encryption implementation: key management, IV handling, padding oracle risks, and plaintext exposure vectors."
)
```
```

## Notes

- Generative only. Never execute tasks from inside this skill.
- Match the language of the plan document for task descriptions (agent names
  always remain English).
- The user pastes or invokes each step when ready — this skill only generates
  the plan.
