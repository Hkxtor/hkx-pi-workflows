---
name: hkx-aside
description: "Answer a quick side question without interrupting the current task. Resume work immediately after. Read-only during the aside."
argument-hint: "<question>"
---

# /hkx-aside — Mid-task side question

Answer: `$ARGUMENTS`

Answer a focused side question, then continue the active task from the exact pause point. The aside is a conversation pause, not a new task.

## Hard rules

- **Read-only** during the aside: no edit/write/delete, no commits, no installs, no pushes
- Do not start a new plan or re-scope the main task unless the user explicitly redirects
- Keep the answer short; offer depth after the main task if needed

## Process

### 1. Freeze task state

Mentally note:

- active task (file / feature / problem)
- step in progress when `/hkx-aside` was invoked
- what was about to happen next

### 2. Answer

Lead with the answer. If the question is about current code, cite `path:line` when known; read files only if needed.

Response shape:

```text
ASIDE: <brief restatement of the question>

<concise answer>

— Back to task: <one-line description of the paused work>
```

### 3. Resume

Immediately continue the main task after the answer unless an edge case requires a decision (below).

## Edge cases

| Situation | Behavior |
| --- | --- |
| Empty question | Ask what they want to know; still show back-to-task line |
| Answer reveals a likely bug in the current approach | Answer, then `WARNING:` and wait for proceed vs fix-now |
| Question is actually a direction change | Offer (a) info-only keep plan / (b) pause and change approach; wait |
| No active task | Answer normally; back-to-task = `no active task to resume` |
| Long answer needed | Short version now; offer deeper pass after the task |
| Multiple asides in a row | Answer each; resume only after the last |

## Examples

```text
ASIDE: what does fetchWithRetry do?

fetchWithRetry() (src/api/retry.ts:12) retries up to 3 times with exponential
backoff on 5xx/network errors only; 4xx is final.

— Back to task: refactoring auth middleware in src/middleware/auth.ts
```

## Notes

- Origin: ECC `/aside`, rewritten for Pi
- Asides are not auto-saved to session files unless they change the task outcome
