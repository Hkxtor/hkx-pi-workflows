---
name: hkx-codebase-onboarding
description: "Generate onboarding maps for unfamiliar repos: reconnaissance, architecture, entry points, conventions, commands, and starter guidance. Use for handoffs or first-week orientation. Not raw ownership/inventory scans (repo-scan) or launch readiness audits (production-audit)."
origin: HKX-converted-for-Pi
---

# HKX Codebase Onboarding For Pi

Use when opening an unfamiliar repository, preparing a handoff, or generating a concise onboarding guide for maintainers or Pi agents.

## Phase 1: Reconnaissance

Gather signals without reading every file:

- Manifests: `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `pubspec.yaml`.
- Framework/config fingerprints: app configs, tsconfig, Dockerfiles, CI workflows, test configs, env examples, Pi extension package metadata.
- Entry points: `main`, `index`, `app`, `server`, `cmd/`, `src/main`, routes, commands, extension registration.
- Test layout: `tests/`, `test/`, `__tests__/`, `*.test.*`, `*.spec.*`, `*_test.go`, integration and e2e directories.
- Project guidance: relevant `AGENTS.md`, `.pi/`, command docs, local rules, and package READMEs.

Use Pi `find`, `search`, `read`, LSP, and parallel read-only agents. Read selectively and verify ambiguous signals in code.

## Redaction

- Never copy secret values, tokens, passwords, cookies, JWTs, private keys, or MCP env values into the guide.
- List environment variable names only, not values.
- Redact private hostnames, customer identifiers, absolute home paths, and internal URLs unless the user explicitly asks for a local-only artifact.
- Re-check persisted onboarding artifacts for sensitive data before writing them.

## Phase 2: Architecture Map

Identify:

- Languages, frameworks, runtimes, package managers, and version pins.
- Application shape: monorepo, package, plugin, CLI, service, UI, library, or extension package.
- Key directories and their responsibilities.
- Request/command/event lifecycle from entry point through validation, domain logic, side effects, and output.
- Data stores, external services, MCP/tools, workers, and generated artifacts.

## Phase 3: Conventions

Extract conventions that future work must follow:

- File and symbol naming.
- Import, dependency injection, logging, and error-handling style.
- Test framework, fixtures, and validation commands.
- Git/PR style if observable from local docs or history.
- Security and deployment constraints.

If a convention cannot be proven, say it is unknown instead of guessing.

## Output

Return a compact guide:

```markdown
# Onboarding: <project>

## What This Is
## Tech Stack
## Architecture
## Entry Points
## Directory Map
## Key Workflows
## Conventions
## Validation Commands
## Where To Change Common Things
## Open Questions
```

Write onboarding files only when the user asks for persisted artifacts. Preserve existing project guidance instead of replacing it.

## Anti-Patterns

- Reading the entire repository by default.
- Copying the README without adding structural insight.
- Listing every dependency instead of architecture-shaping ones.
- Inventing commands or conventions.
- Creating long guidance files that future agents will ignore.
