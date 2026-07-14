---
name: hkx-terminal-ops
description: Evidence-first terminal workflow for Pi projects. Use when running commands, checking repo state, debugging CI/build failures, making narrow fixes, or reporting exact verification status.
origin: HKX-converted-for-Pi
---

# HKX Terminal Ops For Pi

Use when the answer depends on real command output, git state, test results, or
verified local behavior.

## Resolve Surface

Before changing anything, identify:

- repo path and package/app
- branch or worktree
- local diff state
- requested mode: inspect, fix, verify, commit, push
- relevant project instructions

Useful starting commands:

```bash
pwd
git status --short --branch
rg --files
```

## Guardrails

- Inspect before editing.
- Stay read-only if the user asked for audit or review only.
- Use repo-local scripts before ad hoc commands.
- Do not claim fixed until the failing proof command was rerun.
- Do not claim pushed, deployed, or published unless the external state changed.
- Do not use destructive git or filesystem commands without explicit approval.
- Preserve unrelated local changes.

## Workflow

1. Read the failure or target surface first.
2. Choose the smallest command that proves the current state.
3. Fix one dominant failure at a time.
4. Re-run the exact failing command or an equivalent narrower proof.
5. Broaden to package or repo gates only after the local failure is solved.
6. Report exact status words.

## Status Words

- inspected
- changed locally
- formatted
- verified locally
- committed
- pushed
- blocked
- not run

## Output

```text
SURFACE
- repo/package:
- mode:

EVIDENCE
- command or file:

ACTION
- changed or inspected:

STATUS
- exact state:
```
