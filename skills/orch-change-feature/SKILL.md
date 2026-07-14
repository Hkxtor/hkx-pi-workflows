---
name: hkx-orch-change-feature
description: Orchestrate altering an existing, working feature to new desired behavior — update its tests to the new spec, change the implementation to match, review, and gated commit. Use when behavior is not broken but should be different.
origin: HKX-converted-for-Pi
---

# HKX orch-change-feature

Thin wrapper over the shared engine in [`hkx-orch-pipeline`](../orch-pipeline/SKILL.md).
## When to Use

- An existing feature **works**, but the desired behavior is different ("change", "adjust", "make it also …", "instead of X do Y").
- Distinguish from siblings:
  - **not** broken → not `hkx-orch-fix-defect` (no bug to reproduce).
  - **not** new → not `hkx-orch-add-feature` (the capability already exists).

## Operation Settings

- **Default size floor:** small — most tweaks are a function or two.
- **Phase mask:** 0 → (1 only if the new behavior needs research) → light 2 → 4 → 5 → 6.
- **First move (phase 4):** update the *existing* tests to express the new desired behavior, then change the implementation until they pass. Changing the tests first is what separates a tweak from a fix.

## How It Works

1. Run the `hkx-orch-pipeline` engine with the settings above.
2. Keep the plan light — only `standard`+ size warrants the full `planner` pass.
3. Stop at **Gate 1** (plan / changed-test approval) and **Gate 2** (pre-commit).
4. Add `security-reviewer` if the change touches a security trigger.

## Example

```text
hkx-orch-change-feature: make nws-poller alert at 2 warnings instead of 3
→ update threshold tests to new spec → change impl to green
→ code-review → commit  [GATE 2: confirm]
```
