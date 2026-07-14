---
name: hkx-git-workflow
description: Pi-safe Git workflow patterns for branch strategy, commits, PRs, conflict resolution, releases, and history-sensitive operations.
origin: HKX-converted-for-Pi
---

# HKX Git Workflow For Pi

Use when preparing commits or PRs, resolving conflicts, choosing branch strategy,
writing release notes, or reviewing git operations with user-impacting risk.

## Operating Defaults

- Inspect before acting. Do not rewrite, reset, delete, tag, push, merge, or publish unless the user explicitly requested it.
- Protect unrelated work. Treat unexpected local changes as user-owned.
- Prefer small, focused branches and PRs.
- Use conventional commits unless the repo has a stronger local convention.

## Branch Strategy

| Strategy | Use When | Notes |
| --- | --- | --- |
| GitHub flow | Most Pi repos and continuous delivery | Branch from `main`, PR, merge after checks |
| Trunk-based | Strong CI and feature flags | Short-lived branches or guarded direct commits |
| GitFlow | Scheduled or regulated releases | Higher overhead; use only when release cadence needs it |

## Commit Messages

```text
<type>(<scope>): <subject>

<optional body explaining why>
```

Common types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `revert`.

Rules:

- Subject is specific, imperative, and has no trailing period.
- Body explains motivation, tradeoffs, and migration notes when useful.
- Do not include generated attribution unless the repo convention requires it.

## Pull Requests

A PR summary should include:

- What changed.
- Why it changed.
- User-visible or operator-visible impact.
- Validation commands and observed results.
- Screenshots, recordings, or traces for meaningful UI/runtime behavior.
- Residual risk or intentionally skipped checks.

Review the branch against the target base, not only the latest commit.

## Merge, Rebase, Reset

- Merge preserves branch history; prefer it for shared branches.
- Rebase is appropriate for local-only branches or branches where all contributors agree.
- Use `--force-with-lease`, not plain force push, and only on branches you own.
- Use `git revert` for pushed shared history.
- Use reset/checkout discard operations only after explicit approval and evidence of what will be lost.

## Conflict Resolution

1. Identify every conflicted file.
2. Read both sides and the surrounding code.
3. Preserve behavior from both branches where possible.
4. Remove conflict markers and stale duplicated logic.
5. Run the focused tests or checks that cover the resolved area.

Never accept `ours` or `theirs` blindly for code, configs, migrations, lockfiles, or docs with contractual meaning.

## Release Notes

For public packages or deployable artifacts, capture:

- Version or tag.
- Features.
- Fixes.
- Breaking changes and migration steps.
- Validation evidence.
- Rollback notes when applicable.

## Pair With

- `hkx-common-git-workflow` for persistent rules.
- `hkx-github-ops` for GitHub issue, PR, CI, and release operations.
- `hkx-verification-loop` before commit, PR, merge, or release.
