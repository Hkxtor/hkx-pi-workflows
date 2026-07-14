---
name: hkx-orch-review
description: Multi-dimension review workflow for code diffs using Pi reviewer agents. Fans out parallel reviews (quality, language-specific, and conditional security), deduplicates findings, and returns blocking vs advisory results. Pi-native port of the orch-review workflow.
version: 1.0.0
origin: ECC-converted-for-Pi
---

# HKX Orch Review — Multi-Dimension Code Review

A multi-dimension review workflow for code diffs. Uses Pi reviewer agents in parallel to assess code quality, language-specific correctness, and security. Deduplicates findings on evidence and produces a blocking vs advisory report.

This is the Pi-native port of the ECC `orch-review.workflow.js` — it replaces the external workflow script with in-process `agent()` and `eval` orchestration.

## When to Activate

- Before merging a PR or committing changes.
- After implementing a feature or fixing a bug.
- When triggered via `/hkx-orch-review`.
- As the review phase of a multi-step development workflow.

## How It Works

```
1. GATHER: compute a unified diff of local changes or fetch a PR diff.
2. DETECT: identify changed file types and the dominant language.
3. FAN OUT: run review agents in parallel — quality, language-specific, and security.
4. DEDUP: collapse findings sharing the same normalized evidence snippet.
5. REPORT: present blocking (CRITICAL/HIGH) and advisory (MEDIUM/LOW) findings.
```

## Review Dimensions

| Dimension | Agent | Trigger |
|---|---|---|
| Code quality | `code-reviewer` | Always |
| Language-specific | `typescript-reviewer`, `go-reviewer`, etc. | By dominant language of diff |
| Security | `security-reviewer` | When changed files include auth, data, API, or secrets-touching code |
| Silent failures | `silent-failure-hunter` | When code has error handling patterns |

### Language Reviewer Selection

Map changed-file extensions to reviewer agents:

| Extension | Reviewer |
|---|---|
| `.ts`, `.tsx`, `.js`, `.jsx` | `typescript-reviewer` |
| `.py` | `python-reviewer` |
| `.go` | `go-reviewer` |
| `.rs` | `rust-reviewer` |
| `.cs` | Use `code-reviewer` (language-specific not in pack) |
| `.java`, `.kt`, `.swift` | Use `code-reviewer` |
| Mixed or non-code | Skip language-specific review |

## Workflow

### Phase 1 — GATHER

Build the unified diff and changed file list:

**Local changes:**
```bash
git diff --name-only HEAD          # changed files
git diff HEAD                      # diff text
```

If the diff is empty, stop: "Nothing to review."

**PR mode (with `gh`):**
```bash
gh pr diff <NUMBER>                # diff text
gh pr view <NUMBER> --json files --jq '.files[].path'  # changed files
```

### Phase 2 — SELECT REVIEWERS

From the changed file list:
1. Always select `code-reviewer` for quality.
2. Determine dominant language from file extensions.
3. If files touch security-sensitive paths (`auth`, `secret`, `credential`, `token`, `password`, `permission`, `admin`, `.env`), add `security-reviewer`.
4. If files include error handling or return patterns, add `silent-failure-hunter`.

### Phase 3 — REVIEW IN PARALLEL

Use `parallel()` to run selected reviewers concurrently. Each receives:
- The diff text
- The list of changed files
- Any relevant language or domain context

Collect results into a unified finding list.

### Phase 4 — DEDUP AND CLASSIFY

1. Normalize each finding by its core evidence snippet (file + line + description).
2. Collapse duplicates — keep the highest severity.
3. Classify: CRITICAL/HIGH → blocking, MEDIUM/LOW → advisory.

### Phase 5 — REPORT

Present the result:

```
=== Orch Review Report ===
Verdict: APPROVE / CHANGES_REQUESTED

Dimensions run: quality, typescript, security, silent-failures
Findings: 14 raw → 8 unique → 3 blocking / 5 advisory

BLOCKING (must clear before commit):
  [HIGH] src/auth.ts:47 — Missing input validation on token
  [CRITICAL] src/api/route.ts:12 — SQL injection via raw query

ADVISORY (consider addressing):
  [MEDIUM] src/lib/cache.ts:83 — Unhandled promise rejection
  [LOW] src/utils/format.ts:22 — Unused import
```

If any review dimension failed to run, say so explicitly — never present a clean APPROVE when the review was incomplete.

## Edge Cases

- **No `gh` CLI in PR mode**: stop and tell the user to use local mode against a checked-out branch.
- **Large diff**: review may be slower but is safe.
- **Binary or generated files**: drop them from changed files before reviewing — they add noise without reviewable content.
- **Mixed-language changes**: use `code-reviewer` plus all relevant language reviewers; do not skip security when any file touches sensitive paths.

## Related

- `hkx-code-review` — Single-pass code review command
- `hkx-review-pr` — PR-specific review orchestration
- `hkx-quality-gate` — Build/type/lint/test gates
- `hkx-build-fix` — Incremental build error resolution
