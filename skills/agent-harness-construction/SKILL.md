---
name: agent-harness-construction
description: Design, revise, or audit Pi agent tools, command prompts, skill prompts, observations, recovery paths, action-space boundaries, and local harness configuration (AGENTS.md, MCP/settings surface, command-skill-rule overlap). Use when adding or changing model-callable capabilities, or when improving an existing harness from a baseline scorecard.
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

## Improving an existing harness

Designing a surface is the section above. **Revising** a harness someone already runs is
its own discipline, because the failure mode is confident tuning with no baseline.

### Workflow

1. **Establish the current surface and the failure mode first.** Capture a baseline
   scorecard before touching anything — command/skill/rule overlap, safety-gate gaps,
   context weight, and the specific symptom that prompted the change. Without a baseline
   "improved" is unfalsifiable.
2. **Name the 1–3 highest-leverage changes.** A harness revision that touches ten
   surfaces at once cannot be attributed or reverted.
3. **Prefer small, reversible edits with measurable effect** over broad rewrites or
   speculative tuning.
4. **Preserve Pi-native conventions and package boundaries.**
5. **Validate, then report before/after impact and what still risks regressing.**

### Focus areas, in the order that usually pays

- `AGENTS.md` clarity and **instruction conflicts** (two rules that disagree are worse
  than one wrong rule — the model picks arbitrarily);
- `.mcp.json`, `.pi/settings.json`, and extension surface layout;
- command / skill / rule overlap and drift (duplicate descriptions buy selection
  friction, not capability);
- safety gates, validation beats, and context hygiene;
- cost and throughput tradeoffs in agent usage.

### Constraints

- Avoid fragile shell quoting in hooks, commands, and generated scripts.
- Preserve cross-platform path and shell behavior.
- **Do not rewrite product code when the real leverage is in harness configuration** —
  report that finding instead of fixing it here.

### Report

1. `Current Surface`
2. `Highest-Leverage Changes`
3. `Applied / Proposed Edits`
4. `Expected Impact`
5. `Remaining Risks`

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
