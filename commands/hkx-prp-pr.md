---
name: hkx-prp-pr
description: "Create a GitHub PR from the current branch — discovers templates, analyzes commits, pushes, opens PR."
argument-hint: "[base-branch] [--draft] (default base: main)"
---

# /hkx-prp-pr — Create Pull Request

> Adapted from ECC `/prp-pr` (PRPs-agentic-eng lineage) for Pi. Pair with `/hkx-prp-commit`.

## GateGuard (create)

1. Callers: operator slash prompt via `pi.prompts`/`commands/`; install-global mirrors to prompts/.
2. Affects: remote branch push + GitHub PR create via `gh`; no package runtime schema.
3. Inputs: base branch name, `--draft`; template paths under `.github/`; `git log`/`diff` vs origin/base.
4. Auth: user "接按 P0 开实现" (ECC prp-pr port).
5. Verify: `npm run validate` frontmatter; requires `gh` auth for live PR (manual).

**Input**: `$ARGUMENTS` — optional base branch name and/or flags (e.g. `--draft`).

**Parse `$ARGUMENTS`**:

- Extract recognized flags (`--draft`)
- Remaining non-flag text = base branch
- Default base branch: `main` (if missing, try `master` only when `origin/main` does not exist)

---

## Phase 1 — VALIDATE

```bash
git branch --show-current
git status --short
git rev-parse --abbrev-ref HEAD
command -v gh
gh auth status
```

| Check | Condition | Action if failed |
| --- | --- | --- |
| `gh` present | `command -v gh` succeeds | Stop: install GitHub CLI — <https://cli.github.com/> |
| Authenticated | `gh auth status` ok | Stop: run `gh auth login` |
| Not on base | Current branch ≠ base | Stop: "Switch to a feature branch first." |
| Clean tree | Prefer no uncommitted changes | Warn + suggest `/hkx-prp-commit`; only continue if user accepts dirty tree |
| Commits ahead | `git log origin/<base>..HEAD` non-empty (fetch first if needed) | Stop: "No commits ahead of `<base>`." |
| No existing PR | `gh pr list --head <branch> --json number,url` empty | Stop with existing PR number/URL |

If remote base ref is missing:

```bash
git fetch origin <base>
```

---

## Phase 2 — DISCOVER

### PR template (first match wins, else multi-file picker)

1. `.github/PULL_REQUEST_TEMPLATE/` — if multiple files, list and choose `default.md` or ask
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. `.github/pull_request_template.md`
4. `docs/pull_request_template.md`
5. `PULL_REQUEST_TEMPLATE.md`

If found, read it and **preserve every section** when filling the body (`N/A` rather than deleting sections).

### Commit analysis

```bash
git log origin/<base>..HEAD --format="%h %s" --reverse
```

- **Title**: conventional commit style; single commit → use its subject; multi-type → dominant type
- **Summary**: group commits by type/area

### File analysis

```bash
git diff origin/<base>..HEAD --stat
git diff origin/<base>..HEAD --name-only
```

Categorize: source / tests / docs / config / migrations.

If **> 20 files**, warn about PR size and suggest splitting when changes are separable.

### Related artifacts (optional references in body)

- `.pi/plans/` — plan / blueprint markdown
- `docs/` PRD or design notes touched by the branch
- Issue numbers mentioned in commit subjects (`#123`)

---

## Phase 3 — PUSH

```bash
git push -u origin HEAD
```

If diverged:

```bash
git fetch origin
git rebase origin/<base>
git push -u origin HEAD
```

On rebase conflicts → stop and report. If force is required after rebase, use **only** `git push --force-with-lease` (never `--force`).

---

## Phase 4 — CREATE

### With template

Fill each template section from commit + file analysis.

### Without template

```markdown
## Summary

<1-2 sentences: what and why>

## Changes

- <grouped bullets>

## Files Changed

- Added/Modified/Deleted paths (grouped)

## Testing

<how verified, or "Needs testing">

## Related Issues

<Closes/Fixes/Relates to #N, or None>
```

### Open the PR

```bash
gh pr create \
  --title "<PR title>" \
  --base <base-branch> \
  --body "$(cat <<'EOF'
<PR body>
EOF
)"
# add --draft when flag present
```

Prefer a HEREDOC/`--body-file` for multiline bodies so shell escaping does not corrupt markdown.

---

## Phase 5 — VERIFY

```bash
gh pr view --json number,url,title,state,baseRefName,headRefName,additions,deletions,changedFiles
gh pr checks --json name,status,conclusion 2>/dev/null || true
```

---

## Phase 6 — OUTPUT

```
PR #<number>: <title>
URL: <url>
Branch: <head> → <base>
Changes: +<additions> -<deletions> across <changedFiles> files

CI Checks: <summary | pending | none configured>

Next steps:
  - gh pr view <number> --web
  - /hkx-code-review or /hkx-review-pr
  - gh pr merge <number>   (only when user asks)
```

## Safety

- Do not merge the PR in this command
- Do not rewrite history beyond the documented rebase + `--force-with-lease` path
- Do not put secrets, tokens, or private paths in the PR body
