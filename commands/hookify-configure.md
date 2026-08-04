---
name: hookify-configure
description: Enable or disable existing Hookify rules by editing frontmatter enabled flags.
argument-hint: "[rule-name … | --list]"
---

# /hookify-configure — Toggle Hookify rules

Interactively (or by name) enable/disable Hookify rules.

Input: `$ARGUMENTS`

## Steps

1. Discover rules the same way as `/hookify-list` (project `.pi/` + global `~/.pi/agent/hookify/`).
2. Show current `name`, `enabled`, `event`, `action`, path.
3. Determine targets:
   - If `$ARGUMENTS` names one or more rules → those names
   - If `--list` only → list and stop (no changes)
   - Otherwise ask which rules to toggle (multi-select ok)
4. For each selected rule, flip `enabled: true` ↔ `enabled: false` in frontmatter **only**. Do not change pattern/body unless the user explicitly asks.
5. Show before → after for each changed file.
6. Confirm writes succeeded. Remind that the extension reloads on path/mtime change for subsequent tool calls.

## Hard rules

- Never delete rule files from this command (toggle only).
- Never rewrite message body or pattern unless user explicitly requests an edit (prefer `/hookify` for new rules).
- If a file fails to parse, report error and skip it.

## Notes

- Origin: ECC `/hookify-configure`, Pi paths.
