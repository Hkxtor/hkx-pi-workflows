---
description: Detect the project build system and incrementally fix build or type errors with minimal safe changes.
argument-hint: "[optional failing command]"
---

# HKX Build Fix For Pi

Diagnose and fix build or type errors. Scope: `$ARGUMENTS`

## Rules

- Prefer the repository's documented validation command.
- In the pi codebase itself, use `bun check`; do not use `tsc` directly.
- Fix one root cause at a time.
- Re-run the failing command after each fix.
- Stop and ask if the fix requires dependency installation, network access, or architecture changes.

## Detection

Choose the first matching command:

| Project signal | Command |
| --- | --- |
| `AGENTS.md` specifies validation | Use that command |
| `package.json` with `check` | Package manager `check` |
| `package.json` with `build` | Package manager `build` |
| `Cargo.toml` | `cargo check` |
| `go.mod` | `go test ./...` |
| `pyproject.toml` | Project test/type command, else `python -m compileall -q .` |

If `$ARGUMENTS` contains a command, run that command first.

## Loop

1. Run the command and capture errors.
2. Group errors by file and root cause.
3. Read the smallest relevant context.
4. Make the minimal fix.
5. Re-run the same command.
6. Continue until green or blocked.

## Summary

Return:

- Initial failing command
- Root causes fixed
- Files changed
- Final validation result
- Remaining blockers, if any
