---
name: hkx-orch-review
description: Run a multi-dimension review over a code diff (local changes or a GitHub PR) using Pi reviewer agents. Covers code quality, language-specific checks, security, and silent-failure detection. Returns blocking vs advisory findings.
argument-hint: "[pr-number | pr-url | blank for local uncommitted changes]"
---

# /hkx-orch-review — Multi-Dimension Code Review

Run a multi-dimension review over a diff (local changes or a GitHub PR). Trigger the `hkx-orch-review` skill for: `$ARGUMENTS`

## Mode Selection

| Input | Mode |
|---|---|
| Blank | **Local Mode** — review uncommitted changes |
| Number (e.g. `42`) or PR URL | **PR Mode** — review a GitHub PR |

## Phase 1 — GATHER

**Local Mode:**
```bash
git diff --name-only HEAD
git diff HEAD
```

If the diff is empty, stop: "Nothing to review."

**PR Mode:**
```bash
gh pr diff <NUMBER>
gh pr view <NUMBER> --json files --jq '.files[].path'
```

## Phase 2 — REVIEW

The skill selects reviewers based on changed files:
- Always: `code-reviewer` for quality
- By dominant language: `typescript-reviewer`, `go-reviewer`, `rust-reviewer`, or `python-reviewer`
- Conditional: `security-reviewer` (auth, secrets, data paths)
- Conditional: `silent-failure-hunter` (error-handling patterns)

## Phase 3 — REPORT

```
=== Orch Review Report ===
Verdict: APPROVE / CHANGES_REQUESTED

BLOCKING:
  [CRITICAL/HIGH] file:line — description

ADVISORY:
  [MEDIUM/LOW] file:line — description
```

## Fail-Closed Contract

Never present a clean APPROVE when the review could not fully run. If any dimension fails, report the incomplete dimensions.

---

*Part of HKX Pi Workflows*
