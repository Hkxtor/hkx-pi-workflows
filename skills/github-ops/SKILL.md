---
name: hkx-github-ops
description: "GitHub operations workflow for Pi projects: issues, PRs, CI checks, releases, changelogs, security alerts, and repository automation. Read-only by default."
origin: HKX-converted-for-Pi
---

# HKX GitHub Ops For Pi

Use when the task depends on GitHub issues, pull requests, workflow runs,
releases, repository settings, or security alerts.

## Defaults

- Read and draft freely.
- Do not comment, label, close, merge, rerun workflows, create releases, or push
  changes without explicit user approval.
- If approval is unclear, produce a local action plan or draft body.
- Prefer `gh` output and GitHub URLs/IDs as evidence.

## Issue Triage

Read:

```bash
gh issue view <number> --comments
gh issue list --state open --limit 50
gh issue list --search "<keywords>" --state all
```

Classify:

- bug
- feature
- question
- documentation
- duplicate
- invalid
- good first issue

Return draft labels/comments rather than applying them unless approved.

## PR Management

Inspect:

```bash
gh pr view <number> --comments --json number,title,state,author,headRefName,baseRefName,mergeable
gh pr checks <number>
gh pr diff <number>
```

Classify:

- ready to merge
- needs changes
- blocked by CI
- needs maintainer decision
- stale
- should be rebuilt manually

Never mark a PR merge-ready from title, summary, or trust alone. Read the diff
and checks.

## CI Operations

Inspect failed runs:

```bash
gh run list --status failure --limit 10
gh run view <run-id> --log-failed
```

Determine whether failure is:

- product regression
- test flake
- infra/cache issue
- auth/secret issue
- workflow/config issue

Do not rerun workflows unless approved.

## Releases

Before release operations:

- confirm target branch
- check CI status
- identify latest tag
- inspect changelog/release script
- summarize changes since last release
- draft notes locally

Creating a GitHub release is an external write action and requires approval.

## Output

```text
GITHUB SURFACE
- repo:
- issue/PR/run/release:

EVIDENCE
- commands or API fields:

CLASSIFICATION
- state:
- rationale:

DRAFT ACTION
- comment/label/release/rerun/merge plan:
```
