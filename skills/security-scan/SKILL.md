---
name: hkx-security-scan
description: "Inventory-style security scan of Pi config surfaces: agent config, extension packages, MCP servers, commands, skills, rules, hooks, secrets handling, permissions, and dependency exposure. Use when setting up or changing Pi automation/config. Not a code threat model or auth design review (use security-review)."
origin: HKX-converted-for-Pi
---

# HKX Security Scan For Pi

Use when setting up or changing Pi configuration, extension packages, MCP servers, commands, skills, rules, hooks, auth, secret handling, or automation that can execute tools.

## Scan Surfaces

| Surface | Check For |
| --- | --- |
| `.pi/` and project settings | Broad permissions, unsafe extensions, private host paths, unreviewed external mutation |
| `package.json` Pi metadata | Unexpected commands, skills, rules, extensions, or install surfaces |
| `commands/` | Prompt injection, auto-run external writes, unsafe shell guidance, missing approval gates |
| `skills/` and `rules/` | Tool misuse, stale harness assumptions, secret leakage, unsafe delegation |
| `extensions/` | Command execution, file writes, network calls, silent failures, unsanitized user paths |
| MCP config | Untrusted packages, hardcoded env secrets, risky server capabilities |
| CI/hooks/scripts | Secret exposure, command injection, bypass flags, unbounded automation |

## Workflow

1. Identify changed security-relevant surfaces.
2. Search for secrets and credential-like literals; redact any evidence before reporting.
3. Review permissions and external mutation paths.
4. Review shell/process execution for quoting, injection, and working-directory assumptions.
5. Review networked tools and MCP servers for least privilege and explicit approval boundaries.
6. Run configured security scanners only when present or explicitly requested.
7. Classify findings by severity and provide concrete fixes.

## Severity

| Level | Meaning |
| --- | --- |
| Critical | Secret exposure, arbitrary command execution, auth bypass, destructive external mutation |
| High | Broad permissions, unsafe MCP/tool capability, missing approval gate for sensitive action |
| Medium | Supply-chain risk, weak validation, silent security failure, excessive logging |
| Low | Documentation, hygiene, or defense-in-depth improvement |

## Findings Format

```text
Severity: Critical/High/Medium/Low
Surface: file or config path
Issue:
Impact:
Fix:
Evidence: redacted, minimal, no secrets
```

## Guardrails

- Do not paste secrets in output.
- Do not auto-fix user-level config unless requested.
- Do not install scanners globally without approval.
- Treat scan tools as evidence, not a substitute for manual review of tool authority.

## Pair With

- `hkx-security-review` for code-level security review.
- `hkx-safety-guard` before mutating config or external systems.
- `hkx-mcp-server-patterns` for MCP server capability design.
