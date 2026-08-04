---
name: ops-pack
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
| Evidence-first local command execution | `terminal-ops` |
| GitHub issues, PRs, CI, releases | `github-ops` |
| Git branches, commits, PR text, conflicts, releases | `git-workflow` |
| Backlog and PR flow classification | `project-flow-ops` |
| Deployment strategy and release gates | `deployment-patterns` |
| Dockerfile and Compose operations | `docker-patterns` |
| Kubernetes manifests, probes, RBAC, autoscaling, kubectl debugging | `kubernetes-patterns` |
| Automation inventory and overlap audit | `automation-audit-ops` |
| Workspace, plugin, MCP, env surface audit | `workspace-surface-audit` |
| Post-deploy URL and endpoint verification | `canary-watch` |
| MCP server design and operational review | `mcp-server-patterns` |
| Destructive-operation and scoped-write guardrails | `safety-guard` |
| Pi config, extension, MCP, secret, and permission scanning | `security-scan` |

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

- "Run/check/debug this repo" -> `terminal-ops`.
- "GitHub issue/PR/CI/release" -> `github-ops`.
- "Commit/branch/rebase/conflict/release notes" -> `git-workflow`.
- "Which PRs/issues should we merge/close/park?" -> `project-flow-ops`.
- "Deploy/release/rollback/health check" -> `deployment-patterns`.
- "Dockerfile/compose/container networking" -> `docker-patterns`.
- "K8s manifests/probes/RBAC/HPA/CrashLoopBackOff debugging" -> `kubernetes-patterns`.
- "What automation exists or overlaps?" -> `automation-audit-ops`.
- "What plugins/MCP/env/config can this workspace use?" -> `workspace-surface-audit`.
- "Check staging/prod after deploy" -> `canary-watch`.
- "Build or review MCP server/tools/resources" -> `mcp-server-patterns`.
- "This could delete, publish, deploy, rewrite, bill, or mutate externally" -> `safety-guard`.
- "Scan Pi config/extensions/MCP/commands/skills/rules for security risk" -> `security-scan`.

## Output

```text
Surface:
Mode: inspect / fix / verify / publish
Evidence:
Action:
Status:
Next operator step:
```
