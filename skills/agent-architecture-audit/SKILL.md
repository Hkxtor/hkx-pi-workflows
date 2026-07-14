---
name: hkx-agent-architecture-audit
description: Audit Pi agent architecture changes across prompts, tools, memory, MCP, retries, compaction, rendering, auth, and persistence. Use before shipping or debugging agent behavior regressions.
origin: HKX-converted-for-Pi
---

# HKX Agent Architecture Audit For Pi

Use this when Pi's agent behavior changes or degrades. The target is the
`packages/coding-agent/` implementation unless the user names another package.

## Activate

- Tool behavior, tool schemas, tool rendering, or tool permissions changed.
- System prompts, prompt templates, skills, rules, or command prompts changed.
- Memory, recall, compaction, handoff, retry, or loop behavior changed.
- MCP, extension loading, marketplace/plugin, or internal URL behavior changed.
- Provider streaming, tool-call conversion, auth fallback, or usage accounting changed.
- The same model behaves correctly outside Pi but fails inside Pi.

## Pi Stack Layers

Audit the smallest relevant slice, but keep these layers in mind:

| Layer | Pi surface |
| --- | --- |
| Prompt contract | `packages/coding-agent/src/prompts/`, `AGENTS.md`, `.pi/skills/` |
| Session history | `packages/coding-agent/src/session/` |
| Memory | `packages/coding-agent/src/mnemopi/`, `packages/mnemopi/` |
| Tool selection | `packages/coding-agent/src/tools/`, `src/tool-discovery/` |
| Tool execution | bash, edit, read, browser, eval, lsp, debug, MCP wrappers |
| Observation rendering | `src/tools/*render*`, `packages/tui/` |
| Retry and repair | auto-retry, TTSR, compaction retry, fallback roles |
| Persistence | session files, SQLite storage, caches, model catalogs |
| External boundary | auth storage, secrets, MCP, extensions, browser, ssh |

## Workflow

1. Identify the user-visible failure:
   - what the user asked for
   - what Pi did
   - why that violates the contract
2. Trace the request through only the relevant layers.
3. Compare model-facing input with runtime output:
   - prompt text
   - tool schema
   - converted messages
   - tool result content
   - rendered UI output
4. Look for wrapper regressions:
   - hidden retry changed state
   - compaction removed needed context
   - renderer mutated correct data
   - stale memory or cache reintroduced old facts
   - fallback model saw a different contract
5. Fix the earliest layer that owns the bug.

## Review Checks

- Tool descriptions match actual required input shape.
- Tool errors include a retryable next step or a clear stop condition.
- Rendered previews are sanitized, truncated, and stable in streaming and replay.
- Secret values are obfuscated before model, logs, or debug bundles see them.
- Memory and compaction artifacts cannot override current user intent.
- Fallback/retry paths preserve model role, tools, system prompt, and session metadata.
- Internal URL schemes reject traversal and unsupported writes.
- Extension and MCP failures degrade without crashing the main session.

## Output

Lead with findings. Use this shape:

```text
P1 path/to/file.ts:123 - Short title
Evidence: exact behavior or code path.
Impact: user-visible failure or risk.
Fix: specific owner layer and smallest change.
Verification: focused command or test.
```

If no issue is found, name the layers inspected and the remaining blind spot.
