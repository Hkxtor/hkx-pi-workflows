---
name: hkx-repo-scan
description: Local repository inventory and ownership audit before major refactors, legacy cleanup, dependency review, or architecture reorganization. Use for structural inventory evidence. Not newcomer onboarding guides (codebase-onboarding) or production-readiness risk audits (production-audit).
origin: HKX-converted-for-Pi
---

# HKX Repo Scan For Pi

Use this to understand a repository's real surface before changing architecture,
ownership, dependencies, or large modules.

## Scope

This Pi conversion is local-evidence first. It does not install or run external
repo-scan tooling by default. If the user wants a third-party scanner, present
the command and request approval before downloading or executing it.

## When To Use

- taking over a large or unfamiliar repo
- planning a major refactor
- auditing vendored or embedded third-party code
- identifying generated/build artifacts committed to source
- preparing architecture or ownership decisions
- deciding what to extract, merge, rebuild, or deprecate

## Scan Workflow

1. Inventory files:

```bash
rg --files
find . -maxdepth 3 -type f
```

2. Classify surfaces:

- product source
- tests
- generated files
- vendored/third-party code
- docs
- build/release artifacts
- configs and automation

3. Identify ownership boundaries:

- packages/modules/crates/apps
- entry points
- public APIs
- shared utilities
- duplicated wrappers
- stale compatibility layers

4. Detect embedded dependencies:

- license files
- vendored directories
- copied headers/sources
- minified bundles
- generated SDKs
- patched upstream forks

5. Assign module verdicts:

| Verdict | Meaning |
| --- | --- |
| Core asset | keep and invest |
| Extract/merge | useful but misplaced or duplicated |
| Rebuild | behavior needed, implementation costly |
| Deprecate | low value or dead surface |

## Evidence Commands

Use targeted commands; avoid dumping huge trees:

```bash
find . -maxdepth 2 -type d | sort
rg -n 'generated|do not edit|vendored|license|deprecated|legacy'
rg -n 'TODO|FIXME|HACK|compat|shim'
```

## Output

```text
Repo scan:
- Stack:
- Key modules:
- Third-party/vendored:
- Generated/build artifacts:
- Duplication/dead weight:
- Verdicts:
- Recommended next pass:
```
