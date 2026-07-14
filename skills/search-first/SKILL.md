---
name: hkx-search-first
description: Research-before-coding gate for Pi projects. Use before adding dependencies, integrations, helpers, tools, abstractions, MCPs, or custom implementations. Not for open-ended topic research, market diligence, or library doc lookups (use research-ops / documentation-lookup).
origin: HKX-converted-for-Pi
---

# HKX Search First For Pi

Use this before writing custom code for a problem that may already have a local
implementation, package, SDK, MCP, extension, or documented pattern.

## Triggers

- adding a dependency or integration
- writing a new utility/helper/adapter
- adding an Pi tool, extension, command, rule, or skill
- choosing a package, SDK, parser, protocol library, or test harness
- replacing existing code with a custom abstraction

## Workflow

1. Define the need:
   - capability
   - language/runtime
   - security and license constraints
   - required maintenance surface
2. Search local repo first:
   - `rg --files`
   - targeted `rg` for existing names, concepts, imports, tests, and docs
3. Check project package manager and manifests:
   - `package.json`, `bun.lock`, `pyproject.toml`, `Cargo.toml`, `go.mod`
   - existing package-local patterns
4. Check available knowledge surfaces:
   - repo docs
   - Pi skills/rules/commands
   - configured MCP/docs tools when relevant
5. Search external sources only when current information matters or the local
   repo lacks the answer.
6. Decide: adopt, extend, compose, build, or defer.

## Decision Matrix

| Signal | Decision |
| --- | --- |
| Existing local helper covers it | Reuse local helper |
| Existing dependency already installed | Use existing dependency |
| Small reputable dependency solves exact problem | Adopt |
| Good package lacks project-specific wrapper | Extend thinly |
| Several small pieces fit cleanly | Compose |
| No maintained solution or security constraint blocks it | Build |
| Requirement unclear | Defer and ask for scope |

## Pi Guardrails

- Prefer existing Pi package patterns over introducing new frameworks.
- Do not install packages without explicit user approval when network access or
  dependency changes are required.
- Use official docs or Context7-style current docs for APIs that may have changed.
- Do not report "nothing found" if a search channel was unavailable.
- Keep dependency choices compatible with the repo package manager.

## Output

```text
Need:
Local evidence:
External evidence:
Options:
Decision:
Next implementation step:
```
