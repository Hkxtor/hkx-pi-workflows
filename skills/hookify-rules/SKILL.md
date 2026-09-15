---
name: hookify-rules
description: "Write and maintain Hookify behavior-guardrail rules for Pi: Markdown+YAML pattern files enforced by the hkx-hookify extension. Use when creating, editing, listing, or toggling hookify rules, or when the user wants to prevent a repeated agent behavior. Not for destructive-command gating (use gateguard), instinct evolve, or full security threat review."
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
| Destructive bash command gating | `gateguard` / GateGuard extension |
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
| `bash` | `tool_call` on `bash` / `powershell` | yes if `action: block` |
| `file` | `tool_call` on `edit` / `write` / `ast_grep_replace` | yes if `action: block` |
| `prompt` | `before_agent_start` | **no** — inject + notify only |
| `stop` | `agent_end` | **no** — notify only |
| `all` | union of the above | per-phase |

`bash` is the **shell surface**, not literally the tool named `bash`: on win32 pi exposes
`powershell` instead of the native `bash` tool, and both names map to the same
`event: bash` rules. A rule keyed to `bash` therefore fires on Windows too.

`warn` always notifies via `ctx.ui.notify` and **allows** the tool call.  
`block` returns `{ block: true, reason }` for bash/file only.

Disable the whole extension for a session:

```text
HKX_HOOKIFY=off
```

## Known footgun: shell commands the bash parser cannot resolve

Pi parses every shell command with `tree-sitter-bash`, even on Windows where the tool
is `powershell`. When the parse only partly resolves, pi-permission-system fails closed:
the **whole** command is floored to a prompt tagged `<unparsed-bash-subtree>`, so an
already-allowed command still stops to ask — and the prompt names unrelated leading
lines (e.g. a leading `cd`) because the error span starts there.

PowerShell control flow has no bash grammar. Blocking it is the one guardrail worth
enabling locally; copy this into `.pi/hookify.block-unparseable-powershell-control-flow.local.md`
(project rules are gitignored — see Rule locations above):

```markdown
---
name: block-unparseable-powershell-control-flow
enabled: true
event: bash
action: block
pattern: "(?:^|[\\r\\n;&|{}]\\s*)(?:(?:if|foreach|while|for|switch)\\s*\\([^\\r\\n]*\\)\\s*\\{|do\\s*\\{|function\\s+[\\w-]+\\s*\\{)"
---
This command contains a PowerShell control-flow block. Rewrite it as `||` / `&&`
chains or separate tool calls, or check it first with
`node scripts/shell-command-preflight.mjs --command "<command>"`.
```

Verified failing shapes: `if (...) { }`, `foreach/while/for/switch (...) { }`,
`do { } while (...)`, `function Name { }`. Verified **non**-failing neighbours the
pattern must not match: `if [ ]; then; fi`, `if (( x > 0 )); then`, `for..do..done`,
`while..do..done`, `case..esac`, `name() { }`, and any `if (...)` inside quotes
(awk/sed programs, `node -e "..."`).

Use the preflight helper for a definitive answer — it loads the same
`tree-sitter-bash.wasm` and reports the error nodes directly.

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
| `/hookify [description]` | Draft + confirm + write a project rule (no args → conversation analysis) |
| `/hookify-list` | Table of project + global rules |
| `/hookify-configure` | Toggle `enabled` |
| `/hookify-help` | Full operator help |

Creation must **propose first** and only write after user confirmation. Default `action: warn`.

## Relationship to other surfaces

- **GateGuard** — hard-blocks matched destructive Bash commands while enabled; it does not gate edits, authorize file writes, or provide an in-session exemption. Not pattern-based.
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
