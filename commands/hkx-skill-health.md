---
name: hkx-skill-health
description: Audit and report the health state of all installed skills in the current ECC or Pi skill portfolio.
argument-hint: ""
---

# /hkx-skill-health - Skill Portfolio Health Audit

Audit and report the health state of all installed skills in the current ECC or Pi skill portfolio.

## What It Does

This command analyzes SKILL.md files under `skills/` directories and performs a basic audit:

- checks frontmatter validity (name, description, version fields)
- checks file structure completeness
- checks description completeness
- reports warnings for missing or malformed fields

## Usage

```bash
/hkx-skill-health
```

## Audit Process

Use `glob`, `grep`, and `read` tools to inspect skill files:

1. **Discover skills** — Use `glob` to find all `**/SKILL.md` or `skills/*/SKILL.md` files
2. **Read frontmatter** — Use `read` to extract the YAML frontmatter from each file
3. **Validate** — Check that each skill has:
   - A `name` field matching its directory name
   - A non-empty `description`
   - Valid YAML structure
   - No orphaned references to non-existent skills
4. **Report** — Present findings grouped by severity

## Report Format

```
Skill Health Audit
==================
Total skills: {N}
Healthy:       {N}
Warnings:      {N}
Errors:        {N}

Warnings:
- {skill-name}: {issue}

Errors:
- {skill-name}: {issue}
```

## What to Look For

- Missing or empty `description` field
- `name` field that does not match directory or filename convention
- Malformed YAML frontmatter (parsing errors)
- Broken `---` delimiters
- Stale or orphaned skills no longer referenced in README or conversion map

---

*Part of HKX Pi Workflows*