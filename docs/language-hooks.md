# Language Rules and Extensions

This document explains the two lightweight enforcement layers in `hkx-pi-workflows`:

- **rules** — prompt-time language guidance and reminders
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

Rules are best for:

- coding style
- testing policy
- security reminders
- narrow language-specific pitfalls such as `console.log`, bare `except`, or Rust `unwrap`

Choose a rule when the behavior should stay:

- lightweight
- prompt-visible
- advisory rather than runtime-enforced

## Extensions

Extensions are the runtime hook layer.

Choose an extension when the behavior must react to live tool events, for example:

- reminding the operator to run validation after a mutation
- blocking risky edits until investigation facts are gathered
- surfacing low-noise runtime guidance that should not live in every prompt

### hkx-language-quality.ts

Post-execution notification extension.

Current behavior:

- Observes successful `edit`, `write`, and `ast_grep_replace` tool results.
- Extracts touched file paths from tool input and details.
- Shows a UI notification listing suggested validation checks.
- Logs a debug entry for diagnostics.

It does not:

- auto-format files
- run build commands
- modify files
- block tool calls

That default keeps the pack safe for projects that have not opted into automatic command execution.

### hkx-gateguard.ts

Pre-execution fact-forcing gate extension.

Current behavior:

- Intercepts `tool_call` events for `edit`, `write`, `ast_grep_replace`, and `bash` before execution.
- Blocks first access to each file with investigation questions (which importers, schemas, user instruction).
- Blocks destructive Bash commands (`rm -rf`, `git push --force`, `DROP TABLE`, etc.).
- Tracks per-session state so a file passes the gate after the first denial.
- Condenses denial messages after the first three full denials to prevent context bloat.
- **Pre-authorizes** writes under `.pi-subagents/` (chain-runs + artifacts), including bash redirects into those paths, so review-only chain `outputMode: file-only` does not detach on GateGuard friction.

Disable per-session:

```text
HKX_GATEGUARD=off
```

It does not:

- auto-investigate files
- run commands on the agent's behalf
- persist state across sessions

Complementary surfaces:

- `skills/gateguard/SKILL.md` — prompt-level gate guidance and output format
- `skills/safety-guard/SKILL.md` — runtime safety checks that do not overlap with the gate
- `hkx-subagent-supervisor-auto-reply.ts` — parent auto-approves artifact-write intercom asks

### hkx-subagent-supervisor-auto-reply.ts

Parent-session extension that keeps review chains from stalling on artifact writes.

Current behavior:

- On `session_start`, polls the native pi-subagents supervisor channel under the process tmpdir.
- Auto-replies only to `need_decision` requests that look like **artifact-write / GateGuard / chain-run path** authorization (mentions `.pi-subagents`, `chain-runs`, configured output, etc.).
- Does **not** auto-reply to product, architecture, or trade-off decisions.
- Rate-limits UI notifications.

Disable per-session:

```text
HKX_SUPERVISOR_AUTO_REPLY=off
```

Together with GateGuard's `.pi-subagents/` allowlist, this closes the detach loop where review children escalated solely to land `adv/*.md` outputs.

## Placement Guide

Use this rule-of-thumb:

- put **general language guidance** in `rules/`
- put **workflow explanation** in `skills/`
- put **runtime reaction** in `extensions/`

If a rule is becoming dynamic or stateful, it probably wants an extension.
If an extension is becoming a long teaching document, it probably wants a skill.

## Possible Future Additions

Likely future optional additions:

- a separate opt-in auto-fix extension with explicit settings
- per-language optional packs for deeper framework-specific behavior
- project-local rule overlays under `.pi/rules/` for repo-specific standards

## Related Docs

- `docs/README.md` — documentation index and routing guide
- `docs/architecture.md` — layer boundaries across commands, skills, rules, agents, chains, and extensions
- `docs/conversion-map.md` — current package surface map
- `docs/skill-routing.md` — primary skill choice when families overlap
