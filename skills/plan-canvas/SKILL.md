---
name: hkx-plan-canvas
description: "Open local plan/HTML artifacts in a loopback browser canvas for annotate/chat/approve review. Use after /hkx-plan or /hkx-blueprint. Not for live apps or remote URLs."
version: 1.0.0
origin: ECC-converted-for-Pi
---

# Plan Canvas (Pi)

Local browser review surface for plans and HTML artifacts. The human annotates elements, chats, and delivers **Approve** / **Request changes** while the agent blocks on a CLI that returns JSON feedback.

Operator entry: `/hkx-plan-canvas`.

## When to Use

- You wrote `.pi/plans/*.md` / `.blueprint.md` and need an approve gate
- Feedback is easier pointed-at than typed
- Comparing plan variants as local HTML

### Do Not Use When

- Code diff review → `/hkx-code-review` / `/hkx-santa-loop`
- Running a product web app
- Remote URLs (local files only)

## CLI

Zero extra npm deps. From package root (or any checkout that has the scripts):

```bash
node scripts/plan-canvas.cjs open .pi/plans/feature.plan.md
node scripts/plan-canvas.cjs await .pi/plans/feature.plan.md
node scripts/plan-canvas.cjs await .pi/plans/feature.plan.md --reply "Updated phase 2."
node scripts/plan-canvas.cjs end .pi/plans/feature.plan.md
node scripts/plan-canvas.cjs stop
```

If `package.json` `bin` is linked:

```bash
hkx-plan-canvas open .pi/plans/feature.plan.md
```

Server: loopback `127.0.0.1:4517` (override `HKX_PLAN_CANVAS_PORT`).  
State: `~/.pi/plan-canvas/` (override `HKX_PLAN_CANVAS_STATE_DIR`).  
Idle: `HKX_PLAN_CANVAS_IDLE_MS`. Mermaid CDN override: `HKX_PLAN_CANVAS_MERMAID_URL`.

## Agent loop

1. `open <file>` — returns immediately; opens browser when possible
2. `await <file>` — block until human feedback/verdict/end; stdout is JSON; stderr is progress
3. On annotations/chat: edit the artifact (canvas live-reloads), then `await --reply "..."`
4. On `verdict: approve` → stop polling, `end <file>`, begin implementation
5. On `verdict: request-changes` → revise and continue the loop

### Example await payload

```json
{
  "status": "feedback",
  "items": [
    {
      "kind": "annotation",
      "text": "Split this into two phases",
      "anchor": { "selector": "h2:nth-of-type(3)", "tag": "h2", "snippet": "Phase 2" }
    },
    { "kind": "verdict", "verdict": "request-changes" }
  ]
}
```

Kinds: `chat` | `annotation` | `verdict` (`approve` | `request-changes`).

## Diagrams

Prefer fenced `mermaid` blocks in plan markdown; the canvas renders them when the browser can load Mermaid (or falls back to source).

## Security notes

- Binds loopback only; Host/Origin gated via `scripts/lib/loopback-guard.js`
- Serves local artifact paths only — never fetch remote review targets
- Do not put secrets into plan files opened in the canvas

## Integration

| Surface | Relationship |
| --- | --- |
| `/hkx-plan`, `/hkx-blueprint` | Produce artifacts this reviews |
| Delegation Completion Contract | Agent owns the await loop until verdict |

## Notes

- Origin: ECC `plan-canvas` / `ecc-plan-canvas`, vendored and rebranded for Pi (`.pi/plans`, `~/.pi/plan-canvas`, `HKX_PLAN_CANVAS_*`)
