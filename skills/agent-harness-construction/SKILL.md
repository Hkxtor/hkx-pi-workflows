---
name: hkx-agent-harness-construction
description: Design or revise Pi agent tools, command prompts, skill prompts, observations, recovery paths, and action-space boundaries. Use when adding or changing model-callable capabilities.
origin: HKX-converted-for-Pi
---

# HKX Agent Harness Construction For Pi

Use this when building or changing how the Pi agent acts: tools, prompts,
skills, rules, slash commands, extensions, MCP wrappers, or subagent workflows.

## Harness Contract

Good Pi harness surfaces make the model's next correct action obvious:

- narrow tool names
- typed schemas
- deterministic output
- bounded side effects
- visible recovery instructions
- compact observations
- no overlapping tools unless the distinction is explicit

## Choose the Surface

| Need | Prefer |
| --- | --- |
| Model-readable workflow or domain guidance | `.pi/skills/<name>/SKILL.md` |
| User-invoked workflow | `.pi/commands/<name>.md` |
| Passive correction when a pattern appears | `.pi/rules/<name>.md` |
| Model-callable runtime action | tool or extension tool |
| Runtime event interception | extension event handler |
| External service bridge | MCP or extension, depending on lifecycle |

Do not add a tool when a skill or command can solve the problem without runtime
side effects.

## Tool Design Rules

- Schema first. Use the repo's existing Zod or TypeBox pattern.
- Name tools by user intent, not implementation detail.
- Inputs should be narrow enough to validate before execution.
- Outputs should include concise text plus structured details when downstream code reads them.
- Error output must say whether retry is safe.
- Long outputs need summaries, anchors, artifact paths, or selectors.
- Destructive operations need explicit permission and clear preview.
- Tool prompts should teach use, input grammar, examples, and model-owned failures only.

## Observation Design

Every result should help the next step:

```text
status: success | warning | error
summary: one-line outcome
evidence: paths, ids, counts, or snippets
next: safe retry, verification, or stop condition
```

Keep raw logs out of the model context unless the exact bytes matter. Prefer
artifact paths or bounded excerpts.

## Pi-Specific Guardrails

- Prompts live in static `.md` files and are imported as text.
- Avoid inline prompt strings in product code.
- Use centralized render helpers for tabs, width, truncation, and paths.
- Preserve both live streaming and rebuilt transcript render paths.
- Never let hidden retries silently change the user's requested operation.
- Internal schemes (`skill://`, `pr://`, `issue://`, `memory://`, etc.) need traversal checks.
- If a tool exposes external state, define read-only vs write behavior in the prompt.

## Verification

For harness changes, verify the contract the model/user sees:

- focused unit test for schema, output, or failure mapping
- replay/streaming test when UI output can differ
- smoke test when compiled binary behavior can differ
- `bun run check:ts` for TypeScript surfaces
- package-local test first, broader test only when shared behavior changed

## Done

The harness change is done only when:

- the model has one clear path to the intended action
- invalid input fails before side effects
- failure output supports recovery
- user-visible output is stable and sanitized
- focused verification covers the public contract
