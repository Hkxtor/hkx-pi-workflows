---
description: Subagents with ctx_search retrieve prior decisions and indexed knowledge from the shared Magic Context FTS5 library before reading files or reasoning, so a fresh-context child does not lose durable project context.
---

# HKX Shared Context Retrieval

Applies to subagents whose frontmatter `tools:` includes `ctx_search` (investigation, planning, review, and reuse agents).

## Why

A subagent runs in a fresh or forked context. It does not inherit the parent's compacted conversation history. What it *can* inherit is the **shared durable knowledge base**: decisions, constraints, prior findings, and indexed documentation that the parent session wrote to the Magic Context FTS5 library (`~/.local/share/cortexkit/magic-context/context.db` on XDG systems). That library is a shared SQLite store, readable by any agent in the same pi process.

Retrieval is the cheap direction. Writing to the shared library (`ctx_index`, `ctx_fetch_and_index`, `ctx_note`) stays with the parent session per the Delegation Completion Contract — the child returns findings, the parent decides what is durable.

## Rule

Before reading files or reasoning from scratch, a subagent that has `ctx_search` MUST run one `ctx_search` call against the task topic using 2-4 specific technical terms.

- Batch every question into one call: `ctx_search(queries: ["term1 term2", "term3 term4", ...])`.
- Use specific technical terms (function names, file basenames, error text), not generic concepts.
- If results surface a relevant prior decision or finding, cite it and proceed; do not re-derive what is already known.
- If the knowledge base returns nothing relevant, proceed normally with `ffgrep`/`fffind`/`read`. An empty result is not a failure — it means this topic has no prior durable context.

## Scope

Read-only. Subagents do not call `ctx_index`, `ctx_fetch_and_index`, or `ctx_note` — those mutate the shared library and are the parent session's responsibility. A subagent that discovers something durable returns it in its final message; the parent decides whether to index it.

## Anti-patterns

- Skipping `ctx_search` and re-discovering what a prior session already indexed.
- Calling `ctx_search` with a single generic word ("authentication") — that burns a round trip without surfacing the right passage.
- Treating an empty result as an error or a reason to stop. It is not.
- Writing to the shared library from a subagent. The child is an accelerator, not an orchestrator.
