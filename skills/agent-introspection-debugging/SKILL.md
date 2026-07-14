---
name: hkx-agent-introspection-debugging
description: "Debug live/repeated Pi agent failures: loops without progress, context loss, misread tool output, compaction/retry breakage. Use when an agent run is misbehaving. Not loop-contract design (loop-design-check) or architecture audits before shipping (agent-architecture-audit)."
origin: HKX-converted-for-Pi
---

# HKX Agent Introspection Debugging For Pi

Use this when Pi or a subagent is failing as an agent system, not just when a
normal function has a bug.

## Activate

- repeated same tool call or same failed command
- loop limit, retry storm, or no forward progress
- context overflow, compaction, or handoff changed behavior
- stale filesystem, branch, session, or cwd assumptions
- tool result was correct but the agent ignored or misread it
- model fallback/auth fallback produced a different behavior

## Capture First

Before retrying, write down:

```markdown
## Failure Capture
- Goal:
- User-visible failure:
- Last successful action:
- Last failed tool/command:
- Repeated pattern:
- cwd / branch:
- Relevant session, log, or test:
- Assumption to verify:
```

Use local evidence:

- `git status --short --branch`
- focused `rg` over the failing surface
- relevant test output
- recent Pi log excerpt from `~/.pi/logs/`
- session dump only when the failure depends on message history

## Diagnose

Classify one primary cause:

| Pattern | Likely cause | Check |
| --- | --- | --- |
| Same tool repeats | no exit condition or ignored result | inspect last calls and tool result text |
| Retry storms | retryable error too broad | inspect retry decision and backoff path |
| Correct tool, wrong conclusion | observation ambiguity | inspect renderer/result shape |
| Works before compaction | summary lost binding | inspect compaction prep/result |
| Works outside Pi | wrapper regression | compare direct provider vs Pi messages |
| File missing or stale | wrong cwd/worktree/cache | re-check path and git state |
| Auth fallback changes behavior | fallback role mismatch | inspect provider/model/auth selection |

## Recover

Take the smallest reversible action:

- narrow to one command, one test, or one file
- re-read the live file before editing
- reduce logs to the relevant excerpt
- disable broad speculation and prove one hypothesis
- add a contract test before changing shared behavior
- stop if the next action would mutate external state without approval

## Pi-Specific Traps

- Streaming preview path and transcript replay path can diverge.
- Tool-call args may be partial while the model is still streaming.
- Compaction and retry can preserve stale assumptions.
- Subagents may run in different worktrees or with different tool sets.
- Model auth fallback can change provider capabilities.
- A rendered TUI bug can hide a correct internal result.

## Output

Return:

```text
Diagnosis: one sentence.
Evidence: command/file/test/log proving it.
Recovery: smallest action taken or proposed.
Verification: focused command or test.
Residual risk: what was not inspected.
```
