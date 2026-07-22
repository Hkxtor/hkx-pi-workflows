---
description: "Instinct YAML/MD schema fields and encoding rules."
---

# Instinct schema

## Frontmatter fields

| Field | Required | Notes |
| --- | --- | --- |
| id | yes | `[a-z0-9][a-z0-9._-]*` |
| trigger | recommended | Natural language trigger |
| confidence | recommended | 0.0–1.0; invalid → 0.5 |
| domain | recommended | code-style, testing, git, debugging, workflow, security, general |
| source | optional | manual, fixture, om-reflection, import |
| scope | optional | project \| global (default from directory) |
| project_id | optional | 12-hex when project-scoped |
| project_name | optional | Human name |
| created / updated | optional | ISO dates |
| last_seen | optional | Last confirming observation (preferred for decay) |
| om_support_ids | optional | OM reflection/observation ids |

## Body

Recommended sections: `## Action`, `## Evidence`.

Delimiter: YAML frontmatter uses `---`. Do not put bare `---` inside body (use `***`).

## Multi-instinct files

A single file may contain multiple `---` frontmatter blocks (ECC-compatible).

## Encoding

- Read: UTF-8, LF or CRLF
- Write: UTF-8 LF only
