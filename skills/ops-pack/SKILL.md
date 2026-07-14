---
name: hkx-ops-pack
description: "Router for the HKX Pi operations pack: terminal execution, GitHub ops, git workflow, project flow, deployment, Docker, Kubernetes, automation audit, workspace audit, canary checks, MCP server operations, safety guardrails, and security scans."
origin: HKX-converted-for-Pi
---

# HKX Ops Pack For Pi

Use this as the entry point when the task is operational: run or debug commands,
inspect CI, triage GitHub work, prepare deployment, audit automation, verify
post-deploy health, or inspect MCP/plugin workspace state.

## Included Skills

| Need | Skill |
| --- | --- |
| Evidence-first local command execution | `hkx-terminal-ops` |
| GitHub issues, PRs, CI, releases | `hkx-github-ops` |
| Git branches, commits, PR text, conflicts, releases | `hkx-git-workflow` |
| Backlog and PR flow classification | `hkx-project-flow-ops` |
| Deployment strategy and release gates | `hkx-deployment-patterns` |
| Dockerfile and Compose operations | `hkx-docker-patterns` |
| Kubernetes manifests, probes, RBAC, autoscaling, kubectl debugging | `hkx-kubernetes-patterns` |
| Automation inventory and overlap audit | `hkx-automation-audit-ops` |
| Workspace, plugin, MCP, env surface audit | `hkx-workspace-surface-audit` |
| Post-deploy URL and endpoint verification | `hkx-canary-watch` |
| MCP server design and operational review | `hkx-mcp-server-patterns` |
| Destructive-operation and scoped-write guardrails | `hkx-safety-guard` |
| Pi config, extension, MCP, secret, and permission scanning | `hkx-security-scan` |

## Operating Defaults

- Start read-only unless the user explicitly asked for a change.
- Distinguish inspected, changed locally, verified locally, committed, pushed,
  deployed, and blocked.
- Prefer repo-local scripts and docs over invented commands.
- Treat networked tools as read-only by default.
- Draft comments, releases, labels, merges, and posts locally unless the user
  explicitly approves the external action.
- Never claim CI, deploy, or canary status without a concrete proof path.

## Router

- "Run/check/debug this repo" -> `hkx-terminal-ops`.
- "GitHub issue/PR/CI/release" -> `hkx-github-ops`.
- "Commit/branch/rebase/conflict/release notes" -> `hkx-git-workflow`.
- "Which PRs/issues should we merge/close/park?" -> `hkx-project-flow-ops`.
- "Deploy/release/rollback/health check" -> `hkx-deployment-patterns`.
- "Dockerfile/compose/container networking" -> `hkx-docker-patterns`.
- "K8s manifests/probes/RBAC/HPA/CrashLoopBackOff debugging" -> `hkx-kubernetes-patterns`.
- "What automation exists or overlaps?" -> `hkx-automation-audit-ops`.
- "What plugins/MCP/env/config can this workspace use?" -> `hkx-workspace-surface-audit`.
- "Check staging/prod after deploy" -> `hkx-canary-watch`.
- "Build or review MCP server/tools/resources" -> `hkx-mcp-server-patterns`.
- "This could delete, publish, deploy, rewrite, bill, or mutate externally" -> `hkx-safety-guard`.
- "Scan Pi config/extensions/MCP/commands/skills/rules for security risk" -> `hkx-security-scan`.

## Output

```text
Surface:
Mode: inspect / fix / verify / publish
Evidence:
Action:
Status:
Next operator step:
```
