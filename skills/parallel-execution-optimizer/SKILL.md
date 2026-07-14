---
name: hkx-parallel-execution-optimizer
description: Plan and run Pi parallel reads, agents, checks, and independent work lanes without sacrificing correctness.
origin: HKX-converted-for-Pi
---

# HKX Parallel Execution Optimizer For Pi

Use this when speed comes from independent work: repo inspection, file reads, API checks, browser checks, focused validation lanes, or multi-agent implementation across disjoint files.

## Core Pattern

Turn urgency into a dependency graph before acting.

1. Define the objective and done signal.
2. Split work into lanes.
3. Mark each lane as parallel, sequential, or gated.
4. Batch independent `read`, `find`, `search`, browser observations, and metadata checks.
5. Use `task` agents for independent investigation or file-disjoint implementation.
6. Keep writes isolated by file, package, worktree, service, dataset, or external system.
7. Merge only after evidence shows lanes are compatible.
8. End with a verification table, not a speed claim.

## Lane Matrix

```text
Lane | Parallel? | Write surface | Risk | Verification
Repo scan | yes | none | low | findings list
Backend patch | maybe | src/api | medium | focused unit tests
Frontend patch | maybe | app/components | medium | component/browser check
Deploy readback | after build | external service | high | live URL + logs
```

## Execution Rules

- Parallelize reads and independent agent tasks aggressively.
- Do not parallelize destructive commands, migrations, production deploys, billing changes, or writes to the same data surface without an explicit gate.
- If a lane discovers a blocker that changes shared contracts, pause dependent lanes and update the matrix.
- Do not leave background work running beyond the requested task unless the user explicitly asked for a continuing service.
- Subagents should receive exact targets, non-goals, and acceptance criteria; do not hand them vague package-wide work.
- The parent agent owns final synthesis and validation across the union of changes.

## Failure Modes

- Creating conflicting edits in the name of speed.
- Treating “parallel” as a substitute for design.
- Letting agents independently invent incompatible APIs.
- Forgetting to poll or synthesize subagent results.
- Reporting completion before verification covers every changed lane.

## Output

```text
Parallel plan:
Lanes run:
Completed lanes:
Blocked lanes:
Compatibility checks:
Verification:
Residual risk:
```
