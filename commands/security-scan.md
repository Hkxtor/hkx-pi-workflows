---
description: Scan agent, workflow, dependency, secret, and config surfaces for security risks.
argument-hint: "[path | blank for current project]"
---

# HKX Security Scan For Pi

Scan target: `$ARGUMENTS`

Default target is the current project. This command is read-only unless the user explicitly asks for fixes.

## Surfaces

Inspect:

- Secrets in source, config, test fixtures, and docs
- Agent guidance: `AGENTS.md`, `.pi/`, `.codex/`, `.gemini/`, `.opencode/`
- Pi extension package files: `commands/`, `skills/`, `rules/`, `tools/`, `extensions/`
- MCP config: `.pi/mcp.json`, `.mcp.json`, and user/project equivalents when in scope
- Shell commands embedded in workflow docs
- Dependency manifests and lockfiles

## Checks

Look for:

- Hardcoded API keys, tokens, private keys, webhooks, cookies
- Remote fetch and execute patterns
- Unpinned package execution in trusted workflows
- Commands that push, publish, merge, delete, or mutate external resources without approval
- Prompt injection risks in commands or skills that process untrusted content
- Path traversal, unsafe file writes, or broad destructive shell operations

## Report

Use severity:

| Severity | Meaning |
|---|---|
| Critical | Secret exposure, credential abuse, destructive external action |
| High | Exploitable injection or unsafe default |
| Medium | Risky pattern needing guardrails |
| Low | Hardening or documentation issue |

For each finding include file, line, issue, impact, and mitigation.
