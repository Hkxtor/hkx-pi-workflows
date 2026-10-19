# Language Rules and Extensions

This document explains the two lightweight enforcement layers in `hkx-pi-workflows`:

- **rules** — prompt-time language guidance and reminders, loaded by `extensions/hkx-rules.ts` (pi does not read the rules directory on its own)
- **extensions** — runtime notifications and gatekeeping

Use this document when deciding whether language-specific behavior belongs in a rule or an extension.

## Rules

Language guidance belongs in `rules/*.md` with rule frontmatter.

```md
---
description: TypeScript and JavaScript coding guidance
globs:
  - "**/*.{ts,tsx,js,jsx}"
---
```

**Pi never reads `~/.pi/agent/rules/` itself.** `extensions/hkx-rules.ts` is the loader: it parses the frontmatter (CRLF-tolerant) and puts rule bodies into the system prompt. Without that extension, a rule file is inert text.

Three frontmatter shapes exist, and the shape decides *when* the model sees the rule:

| Shape | Fields | Delivery |
| --- | --- | --- |
| Always-on | `description` only | Prompt section at the start of every run |
| Path-gated | `description`, `globs` | Once, when the session first touches a matching file |
| Edit-gated | `description`, `condition`, `scope` | Once, when the tool target is in `scope` **and** the written text matches `condition` |

The gated shapes are what keep the always-on cost down (~2,515 tokens for the 8 always-on rules; the 9 gated rules cost nothing until they fire). A path-gated rule matches against the path the tool touched, using `**` for any depth and `{a,b}` for alternation. An edit-gated rule is the right shape for "don't write X" constraints, because it can look at the text being written and stay quiet otherwise:

```md
---
description: Warn when JavaScript or TypeScript edits add console.log.
condition: "console\\.log\\("
scope: "tool:edit(**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}), tool:write(**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs})"
---
```

Rules are best for:

- coding style
- testing policy
- security reminders
- narrow language-specific pitfalls such as `console.log`, bare `except`, or Rust `unwrap`

Choose a rule when the behavior should stay:

- lightweight
- prompt-visible
- advisory rather than runtime-enforced

If the constraint must be **impossible** to violate, a rule is the wrong layer: rules are prompt text, and the model can still disobey. Move it to an extension (`hkx-gateguard.ts` blocks commands outright; `hkx-hookify.ts` can block a tool call). Inspect what rules are actually loaded and what they cost with `/hkx-rules`; disable both injection and promotion with `HKX_RULES=off`.

## Extensions

Extensions are the runtime hook layer.

Choose an extension when the behavior must react to live tool events, for example:

- reminding the operator to run validation after a mutation
- blocking destructive shell commands until the operator confirms scope
- surfacing low-noise runtime guidance that should not live in every prompt

### hkx-language-quality.ts

Post-execution notification extension.

Current behavior:

- Observes successful `edit`, `write`, and `ast_grep_replace` tool results.
- Extracts touched file paths from tool input and details.
- Shows a UI notification listing suggested validation checks.

It does not:

- auto-format files
- run build commands
- modify files
- block tool calls

That default keeps the pack safe for projects that have not opted into automatic command execution.

### hkx-gateguard.ts

Destructive-command hard gate extension.

Current behavior:

- Intercepts `tool_call` events for `bash` before execution.
- Masks quoted strings, backticks, and heredoc bodies before matching so commands that merely *mention* destructive text (regex sources, `echo "git reset --hard"`) are not blocked.
- Blocks destructive Bash commands (`rm -rf`, `git push --force`, `DROP TABLE`, etc.) on the masked skeleton; when an eval-invoker (`bash -c`, `node -e`, `psql -c`, …) is present, the masked fragments are scanned too.
- Condenses denial messages after the first three full denials to prevent context bloat.
- Blocks every matched command while enabled; answering the risk checklist does not create an in-session exemption.
- Directs the operator to use a non-destructive alternative, stop, or restart with `HKX_GATEGUARD=off` after explicit authorization.

Disable before starting or restarting a session:

```text
HKX_GATEGUARD=off
```

It does not:

- auto-investigate files
- run commands on the agent's behalf
- persist state across sessions
- provide an in-session exemption path for blocked commands

Complementary surfaces:

- `skills/gateguard/SKILL.md` — prompt-level decision checklist and hard-gate guidance
- `skills/safety-guard/SKILL.md` — runtime safety checks that do not overlap with the gate
- `hkx-subagent-supervisor-auto-reply.ts` — parent auto-approves scoped permission/configured-output artifact asks
- `hkx-hookify.ts` — user-defined pattern rules (orthogonal to GateGuard)

### hkx-hookify.ts

Operator-authored behavior guardrails (ECC Hookify → Pi).

Current behavior:

- Loads project rules from `.pi/hookify.*.local.md` and global rules from `~/.pi/agent/hookify/`.
- Path B installs the package-managed PowerShell parse-floor guard globally from `configs/hkx-hookify/`; reinstall refreshes its content, preserves `enabled`, and backs up a changed destination.
- On `tool_call`: matches `bash` / `file` (edit, write, ast_grep_replace) rules; `warn` → `ui.notify` and allow; `block` → `{ block: true, reason }`.
- On `before_agent_start`: soft `prompt` rules (notify + system/message inject; cannot hard-block submit). Evaluated only for user-submitted runs; a Pi 1.2.0 idle `sendMessage(..., { triggerTurn: true })` run reports `messageType: "custom"` with no `prompt`, and is skipped rather than matched against an empty prompt.
- On `agent_settled`: soft `stop` rules (notify only), after retries, auto-compaction recovery, and queued continuations have finished. A run that was cancelled is not final settlement: when Pi reports `aborted` (for example after Escape), stop rules are skipped.
- Reloads when rule path mtimes change; skips invalid files with a one-shot warning.
- Supports `pattern` or AND `conditions[]` (operators: regex_match, contains, equals, not_contains, starts_with, ends_with).

Disable per-session:

```text
HKX_HOOKIFY=off
```

It does not:

- replace GateGuard's destructive-command policy
- promote rules into instincts/skills automatically
- hard-block user prompt submit or session end

Complementary surfaces:

- commands `/hookify`, `/hookify-list`, `/hookify-configure`, `/hookify-help`
- skill `hookify-rules`
- agent `conversation-analyzer`

### hkx-subagent-supervisor-auto-reply.ts

Parent-session extension that keeps review chains from stalling on artifact writes.

Current behavior:

- On `session_start`, polls the native pi-subagents supervisor channel under the process tmpdir.
- Auto-replies only to `need_decision` requests that look like scoped **permission / configured-output artifact** authorization (mentions `.pi-subagents`, configured output, blocked writing, etc.).
- Does **not** auto-reply to product, architecture, or trade-off decisions.
- Rate-limits UI notifications.

Disable per-session:

```text
HKX_SUPERVISOR_AUTO_REPLY=off
```

Together with configured chain output instructions and the permission policy, this closes the detach loop where review children escalated solely to land `adv/*.md` outputs.

## Placement Guide

Use this rule-of-thumb:

- put **general language guidance** in `rules/`
- put **workflow explanation** in `skills/`
- put **runtime reaction** in `extensions/`

If a rule is becoming dynamic or stateful, it probably wants an extension.
If an extension is becoming a long teaching document, it probably wants a skill.

One nuance the rules layer introduces: a rule *can* be conditional now (`globs` / `condition`), so "it depends on which file I'm in" is no longer automatically an extension's job. The distinction that still holds is **enforcement**. A conditional rule decides *when to speak*; an extension decides *whether the action happens at all*.

## Possible Future Additions

Likely future optional additions:

- a separate opt-in auto-fix extension with explicit settings
- per-language optional packs for deeper framework-specific behavior
- project-local rule overlays under `.pi/rules/` for repo-specific standards (the current loader reads `~/.pi/agent/rules/` only)
- a per-session toggle to drop a promoted rule back out (today activation is monotonic by design)

## Related Docs

- `docs/README.md` — documentation index and routing guide
- `docs/architecture.md` — layer boundaries across commands, skills, rules, agents, chains, and extensions
- `docs/conversion-map.md` — current package surface map
- `docs/skill-routing.md` — primary skill choice when families overlap
