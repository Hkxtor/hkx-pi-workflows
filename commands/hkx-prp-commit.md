---
name: hkx-prp-commit
description: "Quick commit with natural language file targeting — describe what to commit in plain English."
argument-hint: "[target description] (blank = all changes)"
---

# /hkx-prp-commit — Smart Commit

> Adapted from ECC `/prp-commit` (PRPs-agentic-eng lineage) for Pi. Part of the thin PRP operator surface.

## GateGuard (create)

1. Callers: operator slash prompt via `pi.prompts`/`commands/`; install-global mirrors to prompts/.
2. Affects: git index + creates a commit only; no package runtime schema.
3. Inputs: free-text `$ARGUMENTS`; git status/diff path lists; conventional commit subject.
4. Auth: user "接按 P0 开实现" (ECC prp-commit port).
5. Verify: `npm run validate` frontmatter; manual dry-run of phase 1–2 on a dirty tree when available.

**Input**: `$ARGUMENTS`

---

## Phase 1 — ASSESS

```bash
git status --short
git rev-parse --is-inside-work-tree
```

If not a git work tree → stop: "Not inside a git repository."

If `git status --short` is empty → stop: "Nothing to commit."

Show a short summary of added / modified / deleted / untracked paths.

---

## Phase 2 — INTERPRET & STAGE

Interpret `$ARGUMENTS` to decide what to stage:

| Input | Interpretation | Git approach |
| --- | --- | --- |
| *(blank / empty)* | Stage everything | `git add -A` |
| `staged` | Keep current index | *(no `git add`)* |
| `*.ts` / `*.py` / globs | Stage matching paths | `git add -- '*.ts'` |
| `except tests` | Stage all, then unstage tests | `git add -A` then `git reset --` test globs |
| `only new files` | Untracked only | `git ls-files --others --exclude-standard` → `git add -- <files>` |
| Natural language (e.g. `the auth changes`) | Match status/diff paths by keywords | `git add -- <matched files>` |
| Explicit paths | Stage those files | `git add -- <files>` |

For natural language, cross-reference `git status --short` and `git diff` / `git diff --stat`. Show the user **which files** you will stage and **why** before staging.

After staging:

```bash
git diff --cached --stat
git diff --cached --name-only
```

If nothing is staged → stop: "No files matched your description."

Do **not** use `git commit --no-verify` unless the user explicitly requests it.

---

## Phase 3 — COMMIT

Craft a single-line conventional commit message in imperative mood:

```
{type}: {description}
```

Types: `feat` | `fix` | `refactor` | `docs` | `test` | `chore` | `perf` | `ci` | `style` | `build`

Rules:

- Imperative mood ("add feature" not "added feature")
- Lowercase description after the type prefix
- No trailing period
- Prefer ≤ 72 characters
- Describe **what** changed, not implementation trivia

```bash
git commit -m "{type}: {description}"
```

If hooks fail, report the hook output; do not silently bypass.

---

## Phase 4 — OUTPUT

```
Committed: {hash_short}
Message:   {type}: {description}
Files:     {count} file(s) changed

Next steps:
  - git push              → push to remote
  - /hkx-prp-pr           → create a pull request
  - /hkx-code-review      → review before pushing
```

---

## Examples

| You say | What happens |
| --- | --- |
| `/hkx-prp-commit` | Stages all, auto message |
| `/hkx-prp-commit staged` | Commits only the index |
| `/hkx-prp-commit *.ts` | Stages TypeScript files |
| `/hkx-prp-commit except tests` | Stages non-test changes |
| `/hkx-prp-commit the database migration` | Stages migration-related paths |
| `/hkx-prp-commit only new files` | Stages untracked only |

## Safety

- Never force-add ignored secrets (`.env`, key files); warn and skip
- Never amend unless the user explicitly asks
- Never push in this command (use `/hkx-prp-pr` or `git push`)
