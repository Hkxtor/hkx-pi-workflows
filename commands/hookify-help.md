---
name: hookify-help
description: Operator help for the Hookify behavior-guardrail system (events, format, paths, limits).
---

# /hookify-help — Hookify documentation

Hookify creates **rule files** enforced by the Pi extension `hookify` to warn or block unwanted agent tool use.

## Commands

| Command | Purpose |
| --- | --- |
| `/hookify [description]` | Create rules (conversation analysis if no args) |
| `/hookify-list` | List project + global rules |
| `/hookify-configure` | Enable / disable rules |
| `/hookify-help` | This help |

Skill: `hookify-rules` · Agent: `hkx.conversation-analyzer` · Extension: `extensions/hkx-hookify.ts`

## Rule locations

| Scope | Path |
| --- | --- |
| Project | `.pi/hookify.{name}.local.md` |
| Global | `~/.pi/agent/hookify/hookify.{name}.md` |

## Rule format

```markdown
---
name: descriptive-name
enabled: true
event: bash|file|stop|prompt|all
action: warn|block
pattern: "regex pattern to match"
---
Message shown when the rule triggers.
```

Or `conditions:` list with `field` / `operator` / `pattern` (AND).

## Events (Pi mapping)

| Event | When | Hard `block`? |
| --- | --- | --- |
| `bash` | Bash tool command string | yes |
| `file` | edit / write / ast_grep_replace path & content | yes |
| `prompt` | User prompt at turn start | **no** (inject + notify) |
| `stop` | Agent run end | **no** (notify only) |
| `all` | Union | per phase |

## Actions

- **`warn` (default)** — `ui.notify`, tool still runs
- **`block`** — tool_call returns `{ block: true, reason }` (bash/file only)

## Session switch

```text
HKX_HOOKIFY=off
```

## vs GateGuard vs Instinct

| System | Job |
| --- | --- |
| **Hookify** | User-defined pattern guardrails (immediate) |
| **GateGuard** | Fact-forcing before first edit / destructive bash |
| **Instinct** | Cross-session learned behaviors with accept/promote |

## Pattern tips

- Use regex; escape `.` `(` etc.
- In double-quoted YAML, `\\` → `\`, so `"rm\\s+-rf"` is correct for `rm -rf`
- Avoid overly broad patterns; test against real commands/paths
- Prefer skill `hookify-rules` when authoring complex conditions

## Capability honesty

`prompt` and `stop` cannot hard-stop Pi the way bash/file `block` can. Documented soft enforcement only — do not treat them as a security boundary.
