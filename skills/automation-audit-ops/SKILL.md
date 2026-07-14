---
name: hkx-automation-audit-ops
description: "Read-only automation inventory: CI, hooks, MCP servers, extensions, scripts, scheduled jobs, wrappers, and overlapping automation lanes. Use when asking what automation is live, broken, or duplicated. Not full workspace surface maps, skill portfolio quality, or destructive config GC."
origin: HKX-converted-for-Pi
---

# HKX Automation Audit Ops For Pi

Use when the user asks what automation exists, what is live, what is broken, or
which overlapping surfaces should be kept, merged, cut, or fixed next.

## Inventory Surfaces

Inspect:

- CI workflows
- package scripts
- release scripts
- Pi commands, skills, rules, tools, extensions
- MCP configs and servers
- local extension handlers
- Docker/compose automation
- scheduled jobs or cron-like workflows
- GitHub issue/PR automation

## Live-State Categories

For each item, label:

- configured
- authenticated
- recently verified
- stale
- broken
- missing
- duplicate/overlapping

Do not treat "present in config" as "working".

## Workflow

1. Read current automation files and configs.
2. Group by operational purpose.
3. Identify proof path for live state.
4. Flag overlaps and missing owner.
5. Recommend keep, merge, cut, or fix next.

## Evidence

Use file paths, command output, workflow runs, and config entries. If an external
state check would mutate or require auth, stop at a draft/checklist unless
approved.

## Output

```text
CURRENT SURFACE
- automation:
- source:
- live state:
- proof:

FINDINGS
- broken:
- overlapping:
- stale:
- missing:

RECOMMENDATION
- keep / merge / cut / fix next:
```
