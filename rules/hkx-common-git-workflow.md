---
description: Git commit, branch, PR, release, and history-safety guidance for HKX Pi workflows.
---

# HKX Common Git Workflow

Use this rule when preparing commits, PRs, branch operations, releases, or conflict resolution.

## Commit Messages

Use Conventional Commits:

```text
<type>(<scope>): <description>

<optional body>
```

Common types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `revert`.

Keep the subject specific, imperative, and free of trailing punctuation. Use the body for why the change was needed, not a file-by-file transcript.

## Branches and History

- Prefer short-lived feature branches from the current target branch.
- Keep protected branches deployable and do not rewrite public history.
- Use `--force-with-lease` only for branches you own and only after confirming no one else depends on the old history.
- Use revert, not reset, for already-pushed shared history.
- Before destructive git operations, identify what would be lost and get explicit approval.

## Pull Requests

A PR should include:

- What changed.
- Why it changed.
- Important implementation notes.
- Validation run and results.
- Screenshots or recordings for meaningful UI changes.
- Linked issues or follow-up tracking when relevant.

Review the whole branch against the base, not only the latest commit.

## Conflict Handling

- Read both sides of a conflict and preserve the intended behavior from each branch.
- Re-run focused tests after resolving conflicts.
- Do not accept `ours` or `theirs` blindly unless the user explicitly requested that outcome.

## Releases

- Use semantic versioning when the package has a public version surface.
- Changelogs should group user-visible features, fixes, breaking changes, and migration notes.
- Tags and published artifacts require explicit approval unless the user requested a release.
