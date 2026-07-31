---
name: hkx-hookify-rules
description: "Write and maintain Hookify behavior-guardrail rules for Pi: Markdown+YAML pattern files enforced by the hkx-hookify extension. Use when creating, editing, listing, or toggling hookify rules, or when the user wants to prevent a repeated agent behavior. Not for GateGuard investigation gates, instinct evolve, or full security threat review."
origin: ECC-converted-for-Pi
---

# HKX Hookify Rules

Operator-authored **behavior guardrails**. Rules are Markdown files with YAML frontmatter; the `hkx-hookify` extension enforces them at runtime.

## When to Use

- User says "don't do X again", "block Y", "warn on Z", or "hookify"
- Creating or editing a rule file under `.pi/hookify.*.local.md`
- Choosing `event`, `action`, `pattern`, or `conditions`
- Explaining how Hookify differs from GateGuard / instinct

## When Not to Use

| Need | Prefer |
| --- | --- |
| First-edit investigation questions | `gateguard` / GateGuard extension |
| Cross-session learned behaviors | `instinct-evolve` |
| Auth / threat model review | `security-review` |
| Config surface inventory | `security-scan` |

## Rule locations

| Scope | Path | Git |
| --- | --- | --- |
| Project | `.pi/hookify.{name}.local.md` | ignored (`.pi/` in gitignore) |
| Global (optional) | `~/.pi/agent/hookify/hookify.{name}.md` | outside repo |

## File format

```markdown
---
name: warn-console-log
enabled: true
event: file
action: warn
pattern: "console\\.log\\("
---
Avoid temporary console.log in committed TypeScript.
Prefer a structured logger or remove before PR.
```

### Frontmatter fields

| Field | Required | Values | Notes |
| --- | --- | --- | --- |
| `name` | yes | kebab-case | Prefer `warn-*` / `block-*` / `require-*` |
| `enabled` | no | true/false | Default `true` |
| `event` | yes | `bash` \| `file` \| `prompt` \| `stop` \| `all` | See mapping below |
| `action` | no | `warn` \| `block` | Default **`warn`** |
| `pattern` | one of | regex string | Or use `conditions` |
| `conditions` | one of | list | AND semantics |

Body text = message shown on trigger (keep actionable).

### Advanced conditions

```markdown
---
name: warn-env-api-keys
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
---
You are adding an API key to a .env file. Ensure it is gitignored.
```

**Fields by event**

| Event | Fields |
| --- | --- |
| `bash` | `command` |
| `file` | `file_path`, `new_text`, `old_text`, `content` |
| `prompt` | `user_prompt` |
| `stop` | `stop` (synthetic; `pattern: ".*"` always matches) |

**Operators:** `regex_match`, `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`

## Event → Pi runtime

| Rule `event` | Pi hook | Hard block? |
| --- | --- | --- |
| `bash` | `tool_call` on `bash` | yes if `action: block` |
| `file` | `tool_call` on `edit` / `write` / `ast_grep_replace` | yes if `action: block` |
| `prompt` | `before_agent_start` | **no** — inject + notify only |
| `stop` | `agent_end` | **no** — notify only |
| `all` | union of the above | per-phase |

`warn` always notifies via `ctx.ui.notify` and **allows** the tool call.  
`block` returns `{ block: true, reason }` for bash/file only.

Disable the whole extension for a session:

```text
HKX_HOOKIFY=off
```

## Pattern tips

- Escape regex metacharacters: `.` → `\\.`, `(` → `\\(`
- Prefer unquoted or single-quoted patterns when the regex has many backslashes
- Double-quoted YAML: `\\` becomes `\`, so `"rm\\s+-rf"` → RegExp `rm\s+-rf`
- **Too broad:** `log` matches `login` — use `console\\.log\\(`
- **Too specific:** `rm -rf /tmp/foo` — use `rm\\s+-rf`
- Test mentally against real command/path strings before saving

## Commands

| Command | Job |
| --- | --- |
| `/hkx-hookify [description]` | Draft + confirm + write a project rule (no args → conversation analysis) |
| `/hkx-hookify-list` | Table of project + global rules |
| `/hkx-hookify-configure` | Toggle `enabled` |
| `/hkx-hookify-help` | Full operator help |

Creation must **propose first** and only write after user confirmation. Default `action: warn`.

## Relationship to other surfaces

- **GateGuard** — forces investigation facts before first edit / destructive bash. Not pattern-based.
- **Instinct** — cross-session learned behaviors with accept/promote. Hookify is immediate and explicit.
- **safety-guard / security-*** — broader policy and review; Hookify is a narrow runtime matcher.

## Minimum viable rule

```markdown
---
name: my-rule
enabled: true
event: bash
pattern: dangerous_command
---
Warning message here
```
