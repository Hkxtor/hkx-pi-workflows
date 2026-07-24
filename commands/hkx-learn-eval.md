---
name: hkx-learn-eval
description: "Extract session patterns, run a quality checklist, choose project vs global scope, then save pending instincts or absorb into an existing skill after confirmation."
argument-hint: "[optional focus]"
---

# /hkx-learn-eval — Extract, evaluate, then save

Focus (optional): `$ARGUMENTS`

Extends `/hkx-learn` with a quality gate and save-location decision before any write.

## What to extract

Same categories as `/hkx-learn`: error resolutions, debugging techniques, workarounds, project conventions. Skip trivial and one-off noise.

## Process

### 1. Mine and draft

Identify the single best pattern first (add at most 2 more only if clearly distinct). Draft instinct shape as in `/hkx-learn`.

### 2. Choose scope

Ask: would this help in a **different** project?

| Scope | When | Pending target |
| --- | --- | --- |
| `project` | Repo-specific quirks, local architecture | project pending |
| `global` | Generic techniques usable in 2+ projects | global pending |

When unsure, prefer **project** pending (safer than polluting global). Promotion to global later is `/hkx-instinct-promote`.

### 3. Quality checklist (required)

Actually search before judging:

- [ ] Grep installed / package `skills/` for overlap keywords
- [ ] Check existing instincts (`node scripts/instinct/cli.mjs status` / `--pending`) for near-duplicates
- [ ] Consider whether appending to an existing skill is better than a new instinct
- [ ] Confirm reusability (not a one-off)

### 4. Holistic verdict

| Verdict | Meaning | Action |
| --- | --- | --- |
| **Save** | Unique, specific, well-scoped | Confirm → write pending instinct |
| **Improve then Save** | Valuable but draft weak | Revise once → re-judge |
| **Absorb into [X]** | Belongs in existing skill | Confirm → append to skill (or note path for human) |
| **Drop** | Trivial, redundant, or too abstract | Explain; write nothing |

Guideline dimensions (not numeric scores): specificity, scope fit, uniqueness, reusability.

### 5. Confirm then write

Always show:

```text
### Checklist
- [x]/[ ] skills overlap: ...
- [x]/[ ] instincts overlap: ...
- [x]/[ ] append vs new: ...
- [x]/[ ] reusability: ...

### Verdict: Save | Improve then Save | Absorb into [X] | Drop
**Rationale:** ...
**Scope:** project | global
```

Then the full draft. Only after user confirmation:

- **Save** → write pending instinct with `source: session-learn-eval` (same CLI pattern as `/hkx-learn`)
- **Absorb** → present diff-style addition; apply only if user confirms and the target is in-scope for this session
- **Drop** → no write

Fallback if instinct scripts missing: `.pi/learned/<id>.md`.

### 6. Next steps

```text
Next: /hkx-instinct-status → /hkx-instinct-accept → /hkx-evolve
```

## Notes

- Origin: ECC `/learn-eval`, rewritten onto Pi instinct store (pending → accept → evolve)
- Do not auto-accept pending instincts
- Do not install evolved drafts into package `skills/` without an explicit publish path

## Related

- `/hkx-learn` (faster, lighter gate)
- `/hkx-instinct-from-om`, `/hkx-instinct-accept`, `/hkx-evolve`
- skill: `instinct-evolve`
