---
name: hkx-safety-guard
description: Pi operator guardrails for destructive commands, scoped writes, production systems, migrations, deployments, and autonomous agent loops.
origin: HKX-converted-for-Pi
---

# HKX Safety Guard For Pi

Use when work can destroy data, rewrite history, publish artifacts, mutate external systems, deploy, migrate, or let agents operate with broad write authority.

## Guard Modes

### Careful Mode

Pause before actions such as:

- Recursive delete, broad chmod/chown, or deleting project roots.
- `git reset --hard`, broad checkout discards, branch deletion, or force push.
- Database drop/truncate/destructive migrations.
- Docker or Kubernetes prune/delete operations.
- Publishing packages, releases, comments, messages, emails, invoices, or social posts.
- Bypassing checks with `--no-verify`, `--force`, or equivalent flags.

For each action, state what will change, what could be lost, safer alternatives, and the approval needed.

### Freeze Mode

Constrain writes to an explicitly named directory, package, or file set. Reading may be broader when needed for context, but writes outside the scope require approval.

### Guard Mode

Combine careful mode with freeze mode for production, migration, release, billing, auth, or autonomous-loop tasks.

## Pi Implementation Pattern

- Put the guardrail in the plan and todos before edits.
- Use dedicated tools instead of shell where possible.
- Prefer dry-run, read-only, preview, or validation commands first.
- Keep external systems read-only until the user explicitly approves mutation.
- Record what was inspected, changed locally, verified locally, and externally applied.

## Approval-Gated Actions

Ask before:

- Pushing, merging, tagging, releasing, deploying, publishing, or billing.
- Deleting files or directories outside the requested scope.
- Running irreversible data migrations or cleanup jobs.
- Posting comments, sending messages, or changing issue/PR state.
- Installing global tools or changing user-level config.

## Output

```text
Guard mode:
Allowed write scope:
Blocked or approval-gated actions:
Safer first step:
Verification before mutation:
```

## Pair With

- `hkx-common-security` for default mutation boundaries.
- `hkx-database-migrations` for data changes.
- `hkx-deployment-patterns` and `hkx-canary-watch` for deploys.
- `hkx-git-workflow` for history-sensitive operations.
