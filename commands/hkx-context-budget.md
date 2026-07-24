---
name: hkx-context-budget
description: "Audit Pi agents/skills/rules/MCP/AGENTS token overhead and rank savings. Optional --verbose for per-file breakdown."
argument-hint: "[--verbose]"
---

# /hkx-context-budget — Context overhead audit

Args: `$ARGUMENTS`

Follow the `context-budget` skill.

## Procedure

1. Detect scan roots: package checkout if present, plus `~/.pi/agent/` install.
2. Inventory agents, skills, commands/prompts, rules, MCP, AGENTS/APPEND_SYSTEM.
3. Estimate tokens with skill heuristics; classify Always / Sometimes / Rarely.
4. Print the report template; if `--verbose` in `$ARGUMENTS`, add top-15 heaviest files and MCP tool counts.
5. Recommend at most 5 concrete actions (paths + expected savings). Do not delete anything without explicit user confirmation (`config-gc`).

## Output

End with:

```text
Next: apply cuts deliberately (Path B rules/MCP first), then re-run /hkx-context-budget
```
