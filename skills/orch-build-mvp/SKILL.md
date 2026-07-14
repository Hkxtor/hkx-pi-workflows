---
name: hkx-orch-build-mvp
description: Orchestrate bootstrapping a working MVP from a design or spec document — ingest the doc, plan thin vertical slices, scaffold the first end-to-end slice, then TDD-implement, review, and gated commit. Use to turn an SDD/PRD into a running starting point.
origin: HKX-converted-for-Pi
---

# HKX orch-build-mvp

Thin wrapper over the shared engine in [`hkx-orch-pipeline`](../orch-pipeline/SKILL.md).
## When to Use

- The user has a **design / spec document** (SDD, PRD, system_design) and wants a working vertical slice bootstrapped from it.
- Takes a doc path as its argument, e.g. `.pi/prds/feature-spec.md`.

## Operation Settings

- **Default size floor:** large — this is the full pipeline including Scaffold.
- **Phase mask:** 0 (read the spec) → 1 → 2 (heavy) → 3 (scaffold) → 4 → 5 → 6.
- **First move (phase 0 → 2):** read the doc; extract scope, locked decisions, and the feature list; order it into **thin vertical slices** (one end-to-end path first, not all-models-then-all-views). Phase 3 stands up that first slice.

## How It Works

1. Run the `hkx-orch-pipeline` engine with the settings above.
2. **Vertical slicing:** translate the spec into a `task_list` of thin vertical slices — each slice delivers one end-to-end path.
3. Stand up the first slice as scaffold (phase 3), then TDD-implement each remaining slice.
4. Stop at **Gate 1** (slice plan) and **Gate 2** (pre-commit). Commit the scaffold and each slice as separate `feat:` commits.
5. Add `security-reviewer` for any slice touching a security trigger.

## Example

```text
hkx-orch-build-mvp: .pi/prds/SDD-v0.6.md
→ read SDD → slice list (vertical) → scaffold slice 1  [GATE 1: approve]
→ TDD each slice → review → commit feat:  [GATE 2: confirm] → next slice
```
