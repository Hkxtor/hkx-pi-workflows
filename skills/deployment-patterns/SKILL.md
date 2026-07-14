---
name: hkx-deployment-patterns
description: "Deployment and release operations for Pi projects: CI/CD, rollout strategy, health checks, rollback, artifacts, env config, and production readiness gates."
origin: HKX-converted-for-Pi
---

# HKX Deployment Patterns For Pi

Use when setting up or reviewing deploys, release pipelines, health checks,
rollbacks, artifact publishing, or production runtime configuration.

## Preflight

Identify:

- deploy target
- package/build output
- CI workflow
- required secrets/env vars
- database or storage migrations
- artifact naming and retention
- rollback path
- health check or smoke command

Read local evidence first:

```bash
rg --files | rg 'Dockerfile|compose|workflow|deploy|release|install|package.json|Cargo.toml'
rg -n 'deploy|release|publish|health|rollback|artifact|environment'
```

## Rollout Choices

| Strategy | Use when |
| --- | --- |
| Rolling | normal backward-compatible deploys |
| Blue-green | fast rollback and duplicate infra are available |
| Canary | risky changes with traffic splitting and metrics |
| Manual staged release | package/npm/binary release workflows |

Schema or persistent data changes must be compatible with the chosen rollout.

## Health Checks

A useful health check proves:

- process is running
- required dependencies are reachable
- version/build can be identified
- critical background workers are not wedged

For CLI packages, use smoke commands such as `--help`, `--version`, and one
non-mutating critical command.

## Rollback

Name the rollback path before deploy:

- previous artifact/tag
- config rollback
- database forward-fix or recovery path
- feature flag disablement
- owner and verification command

Do not call a release safe when rollback is unknown for high-impact changes.

## Output

```text
Deployment surface:
Release gates:
Compatibility risks:
Health check:
Rollback:
Next verification:
```
