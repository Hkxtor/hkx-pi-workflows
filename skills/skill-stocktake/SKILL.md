---
name: hkx-skill-stocktake
description: Audit an OMP skill and command portfolio for overlap, staleness, weak descriptions, and missing discoverability. Use for periodic quality reviews of local workflow surfaces.
origin: ECC-converted-for-OMP
---

# Skill Stocktake

Use this skill when auditing local skills and related workflow surfaces for
quality, overlap, and continued usefulness.

## Scope

Audit whichever of these surfaces actually exist in the current environment:

- project `.omp/skills/`
- project `.agent/skills/` or `.agents/skills/`
- user `~/.omp/agent/skills/`
- package-local `skills/` when reviewing an extension repo
- sibling command surfaces when command/skill overlap matters

## Review Questions

For each skill, check:

- is the trigger clear?
- is the description good enough for discovery?
- is the content actionable, not vague philosophy?
- does it overlap heavily with another skill, rule, or command?
- are technical references still current?
- is it clearly better than just putting the guidance in `AGENTS.md` or a rule?

## Verdicts

Assign one verdict per skill:

- `Keep`
- `Improve`
- `Update`
- `Merge`
- `Retire`

Every verdict needs a concrete reason.

## Fast Modes

### Quick Scan

Use when only a few skills changed recently.

- inspect changed files first
- audit only the touched skills plus obvious neighbors
- output delta findings only

### Full Stocktake

Use when the portfolio has drifted or grown noisy.

- inventory every skill
- group by domain
- identify duplicates, weak descriptions, and stale references
- propose merge / retire candidates before any deletion

## Output Contract

Return:

1. `Inventory`
2. `Findings`
3. `Verdicts`
4. `Merge / Retire Candidates`
5. `Top Next Moves`

Never delete or archive skills without explicit user approval.
