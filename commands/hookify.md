---
name: hookify
description: "Create a Hookify behavior-guardrail rule from a description or conversation analysis. Proposes first; writes only after confirmation."
argument-hint: "[description of behavior to prevent]"
---

# /hookify — Create a behavior guardrail

Input: `$ARGUMENTS`

Create a **Hookify** rule so Pi stops (or warns on) an unwanted agent behavior. Rules are enforced by `extensions/hkx-hookify.ts`.

Load skill `hookify-rules` for format details when needed.

## Hard rules

1. **Propose first** — never write a rule file until the user confirms.
2. Default **`action: warn`** unless the user explicitly wants a hard block or the behavior is destructive.
3. Patterns must be **specific** (see skill pitfalls). Reject overly broad patterns like bare `log` or `.*` on `file`/`bash` without justification.
4. Project rules go to **`.pi/hookify.{name}.local.md`** (create `.pi/` if missing).
5. Do not invent GateGuard investigation text; this is pattern matching only.

## Process

### 1. Gather behavior

**If `$ARGUMENTS` is non-empty**

- Parse the unwanted behavior from the arguments.
- Infer `event` (`bash` | `file` | `prompt` | `stop`), a kebab-case `name`, `pattern` or `conditions`, and message body.

**If `$ARGUMENTS` is empty**

- Prefer subagent `hkx.conversation-analyzer` with a task that includes recent conversation context / user corrections (fresh context).
- **Fallback** (no pi-subagents): perform the same analysis **read-only in this session** using the conversation-analyzer output contract (YAML behaviors list). Do not write files during analysis.

### 2. Present proposal

Show each candidate as:

```text
PROPOSED HOOKIFY RULE
name:    …
event:   bash|file|prompt|stop
action:  warn|block
pattern: …   (or conditions: …)
file:    .pi/hookify.{name}.local.md

Message:
…
```

Remind capability limits:

- `bash` / `file` + `block` → hard tool block
- `prompt` / `stop` → notify / inject only (cannot hard-stop submit/end)

### 3. Confirm

Ask which rules to create (all / subset / none). Wait for explicit confirmation.

### 4. Write

For each approved rule, write:

```markdown
---
name: {name}
enabled: true
event: {event}
action: {action}
pattern: "{pattern}"
---
{message}
```

Use `conditions:` instead of `pattern` when the proposal needs AND matchers.

Path: `.pi/hookify.{name}.local.md`  
Align filename `{name}` with frontmatter `name`.

### 5. Confirm result

Report:

- paths written
- how to list: `/hookify-list`
- how to toggle: `/hookify-configure`
- runtime: next matching `tool_call` / turn enforces rules when `hkx-hookify` extension is loaded
- session kill-switch: `HKX_HOOKIFY=off`

## Examples

```text
/hookify warn on console.log in TypeScript writes
/hookify block rm -rf outside /tmp
/hookify
```

## Notes

- Origin: ECC `/hookify`, rewritten for Pi (extension runtime, `.pi/` paths).
- Complements GateGuard (investigation) and instinct (cross-session learning).
