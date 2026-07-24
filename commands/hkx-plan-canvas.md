---
name: hkx-plan-canvas
description: "Open a local plan/HTML artifact in the Plan Canvas browser for annotate-and-approve review. Blocks on human verdict JSON."
argument-hint: "[path/to/artifact.md|html]"
---

# /hkx-plan-canvas — Browser plan review

Artifact: `$ARGUMENTS`

Follow the `plan-canvas` skill.

## Resolve artifact

1. If `$ARGUMENTS` is a path, use it.
2. Else pick the most recently modified file under `.pi/plans/` (prefer `*.plan.md` / `*.blueprint.md`).
3. Else ask which local artifact to open.

## Loop

```bash
# from hkx-pi-workflows package root when possible
node scripts/plan-canvas.cjs open <artifact>
node scripts/plan-canvas.cjs await <artifact>
# after edits:
node scripts/plan-canvas.cjs await <artifact> --reply "<summary of changes>"
# on approve:
node scripts/plan-canvas.cjs end <artifact>
```

- `approve` → plan confirmed; stop polling and start implementation (still no auto-push)
- `request-changes` → edit artifact, reply, await again
- Keep stdout JSON parseable; put chatter in the canvas via `--reply`

## Guardrails

- Local files only
- Read/write the artifact as needed; do not mutate unrelated product code during review
- If the CLI is missing, tell the user to run from a checkout of `hkx-pi-workflows` or install the package bin
