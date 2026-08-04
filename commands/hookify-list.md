---
name: hookify-list
description: List configured Hookify rules (project .pi/ and optional global ~/.pi/agent/hookify/).
---

# /hookify-list — List Hookify rules

Find and display all Hookify rules in a table.

## Steps

1. Scan **project** rules: `.pi/hookify.*.local.md` under the workspace cwd.
2. Scan **global** rules (if present): `~/.pi/agent/hookify/hookify.*.md` (and `*.local.md` if any).
3. Read each file's frontmatter: `name`, `enabled`, `event`, `action`, `pattern` (or note `conditions`).
4. Display:

| Rule | Enabled | Event | Action | Pattern / conditions | Scope | File |
| --- | --- | --- | --- | --- | --- | --- |

1. Print counts (project / global / enabled / disabled).
2. Remind:
   - toggle: `/hookify-configure`
   - create: `/hookify …`
   - help: `/hookify-help`
   - disable extension: `HKX_HOOKIFY=off`

## Empty state

If no files found, say so and show the expected paths plus a minimal example rule.

## Notes

- Read-only command — do not modify rules.
- Invalid / unreadable files: list path + parse error in a separate "Skipped" section.
