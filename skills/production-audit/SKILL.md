---
name: hkx-production-audit
description: "Local-evidence production readiness audit: release/install paths, CI, deploy, migrations, observability, and launch-critical flows. Use when asking \"is this safe to ship?\". Not general repo inventory (repo-scan) or onboarding docs (codebase-onboarding)."
origin: HKX-converted-for-Pi
---

# HKX Production Audit For Pi

Use when the user asks whether a project, release, feature, package, or deploy is
ready to ship.

## Ground Rules

- Build the audit from local or user-authorized evidence.
- Do not upload repo contents to external services without explicit approval.
- Do not run unpinned remote scanners by default.
- Green CI is evidence, not a complete readiness answer.
- Name missing evidence and cap confidence accordingly.

## Evidence

Start cheap:

```bash
git status --short --branch
git log --oneline --decorate -20
git diff --stat
```

Then inspect relevant surfaces:

- package scripts, lockfiles, build config, release scripts
- CI workflows and artifact publishing
- Dockerfiles, compose files, deployment manifests
- auth, permissions, secrets, and environment docs
- migrations, seed, backfill, rollback paths
- observability, logs, health checks, debug bundles
- install/update/uninstall flows
- E2E or smoke coverage for launch-critical paths

## Risk Lenses

### Security

- secrets not committed, logged, bundled, or shown to the model
- authn/authz enforced server-side
- external actions require approval
- untrusted content cannot reach privileged tools unchecked

### Data

- migrations are safe and ordered
- writes are idempotent where retries/webhooks/jobs exist
- backups or recovery paths exist for destructive changes

### Operations

- clean checkout can build from documented commands
- required env vars fail fast
- health check proves dependencies
- rollback/incident owner path is clear

### User Experience

- critical flows work on expected platforms
- loading, empty, error, permission, and offline states are handled
- accessibility basics are not obviously broken

## Scoring

Use score bands to prioritize:

| Score | Meaning |
| --- | --- |
| 0-49 | blocked |
| 50-69 | risky |
| 70-84 | launchable with caveats |
| 85-100 | strong from available evidence |

Cap at 69 for missing auth, unsafe migrations, exposed secrets, or no rollback
for high-impact releases. Cap at 84 if launch-critical paths were not tested.

## Output

```text
Production audit: NN/100, verdict, one-sentence reason.

Blockers:
High-value fixes:
Evidence checked:
Evidence missing:
Next action:
```
