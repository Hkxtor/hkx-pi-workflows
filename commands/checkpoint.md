---
description: Create, compare, or list lightweight Pi workflow checkpoints with verification notes.
argument-hint: "create <name> | verify <name> | list | clear [--keep=N]"
---

# HKX Checkpoint For Pi

Checkpoint request: `$ARGUMENTS`

Use checkpoints to preserve long-task state at meaningful phase boundaries. A checkpoint is a log entry, not a commit, stash, branch, or backup.

## Storage

Use `.pi/checkpoints.log` unless the repository already documents another Pi checkpoint path. Create `.pi/` only when writing a checkpoint.

Each entry should be line-oriented and easy to diff:

```text
YYYY-MM-DDTHH:mm:ssZ | <name> | sha:<short-or-unknown> | verification:<summary> | surfaces:<paths-or-summary>
```

## Modes

### `create <name>`

1. Summarize the current task phase and changed surfaces.
2. Record the current git SHA if available with a read-only command; use `unknown` if unavailable.
3. Run only the verification the user requested or the narrow repo validation that is clearly relevant.
4. Append one checkpoint line to `.pi/checkpoints.log`.
5. Report the checkpoint name, verification status, and next safe action.

Do not automatically commit, stash, push, reset, tag, or create branches.

### `verify <name>`

1. Read `.pi/checkpoints.log`.
2. Find the named checkpoint.
3. Compare current observed state with the entry:
   - changed surfaces,
   - current SHA if available,
   - verification status now versus then,
   - unresolved risks or skipped checks.
4. Report whether the workflow is ahead of, behind, or diverged from the checkpoint.

### `list`

Show checkpoint names, timestamps, SHA values, verification summaries, and surface summaries.

### `clear [--keep=N]`

Keep the latest checkpoints and remove older log entries only after showing what will be removed. Default to `--keep=5`. Never delete source files.

## Good Checkpoint Boundaries

- After research, before implementation.
- After an approved plan or acceptance brief.
- After a migration batch validates.
- Before a risky refactor or external mutation.
- After debugging produces a clear root cause and before applying the fix.

## Output

```text
Checkpoint:
Mode:
Name:
Recorded state:
Verification:
Changed surfaces:
Next:
```
