---
name: hkx-strategic-compact
description: Pi context hygiene guidance for compacting at phase boundaries while preserving plans, evidence, and next actions.
origin: HKX-converted-for-Pi
---

# HKX Strategic Compact For Pi

Use this for long Pi sessions where context size, stale exploration, or phase changes can degrade correctness.

Strategic compaction is a workflow decision, not an automatic trigger. Compact only after durable state has been written or summarized clearly enough to continue.

## Good Compact Boundaries

| Phase transition | Compact? | Why |
|---|---|---|
| Research → plan | Yes | Keep distilled facts and drop exploratory noise |
| Plan approved → implementation | Yes | Preserve plan/todos, free context for code |
| Batch completed → next batch | Yes | Keep deliverables and validation status |
| Debug trace → fix implementation | Maybe | Compact if the trace is large and the root cause is summarized |
| Mid-edit or unresolved conflict | No | Losing file context and line anchors is risky |
| Before unrelated new task | Yes | Prevent stale assumptions from contaminating the next task |

## Before Compacting

Record a compact handoff in the response, a plan file, or another repo-approved artifact:

```text
Objective:
Current phase:
Decisions made:
Files changed or important:
Evidence gathered:
Validation status:
Open blockers:
Next action:
```

If file edits are in progress, finish the current atomic edit and re-read any file that will be touched after compaction.

## When To Compact

Two signals guide the decision:

1. **Context size (primary)** — Sum `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` from the session transcript to get the true context size. Suggest `/compact` at a window-scaled threshold: 160k tokens on a 200k window, 250k on a 1M window. Re-remind after every additional 60k tokens of growth.
2. **Tool-call count (secondary)** — Count tool invocations; suggest at 50 calls, then every 25 calls after.

Context-size is the reliable signal. A few large file reads fill the window in very few calls, while many tiny calls can cross 50 with a near-empty window.

## What Survives Compaction

| Persists | Lost |
|---|---|
| Project instructions and rules | Intermediate reasoning and analysis |
| Active todo list or plan path | File contents previously read |
| Git state (commits, branches) | Tool call history and counts |
| Files on disk | Nuanced user preferences stated verbally |

## What To Preserve

- User's current goal and acceptance criteria.
- Active todo list or plan path.
- Key file paths and symbols.
- Decisions and rejected alternatives.
- Verification already run and what it proved.
- Known failures, blockers, and exact next command or edit.

## What To Drop

- Broad search output already distilled into relevant paths.
- Failed approaches that no longer guide the solution.
- Duplicate docs, examples, or tool output.
- Long logs once the actionable failure line is captured.

## Pi Guardrails

- Do not compact to avoid finishing a task.
- Do not compact before reporting validation failures that need immediate action.
- Do not rely on remembered line numbers after compaction; re-read affected files before editing.
- Do not save secrets, private payloads, or credentials in compact summaries.
- For migration work in this package, keep `README.md`, `docs/conversion-map.md`, and `scripts/validate.mjs` status explicit.

## Output

```text
Compact recommendation:
Boundary:
Preserve:
Drop:
Resume with:
```
