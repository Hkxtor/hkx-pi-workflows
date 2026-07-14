---
name: hkx-skill-stocktake
description: "Audit skill/command portfolio quality: overlap, staleness, weak descriptions, and discoverability. Use for periodic skill conflicts/stocktake reviews. Not workspace inventory, automation inventory, security scan, or delete-cleanup (config-gc)—propose merge/retire only; never delete without approval."
origin: ECC-converted-for-Pi
---

# Skill Stocktake

Use this skill when auditing local skills and related workflow surfaces for
quality, overlap, and continued usefulness.

## Scope

Audit whichever of these surfaces actually exist in the current environment:

- project `.pi/skills/`
- project `.agent/skills/` or `.agents/skills/`
- user `~/.pi/agent/skills/`
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

## Related Routing

For primary-vs-secondary skill choice in this package, see `docs/skill-routing.md` (research, security, UI, product, config, session quality, and related families).
