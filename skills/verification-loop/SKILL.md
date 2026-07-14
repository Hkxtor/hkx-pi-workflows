---
name: hkx-verification-loop
description: "Post-change verification: choose and run focused format, lint, typecheck, unit, language, smoke, or release checks after code or prompt edits. Use immediately after implementation. Not session-end hygiene (delivery-gate) or subjective quality scoring (agent-self-evaluation)."
origin: HKX-converted-for-Pi
---

# HKX Verification Loop For Pi

Use this after a change, before a PR, or when the user asks whether work is
verified. Pick the smallest commands that prove the changed contract.

## Start

1. Inspect worktree state:

```bash
git status --short
git diff --stat
```

2. Identify changed surfaces:

| Surface | Typical checks |
| --- | --- |
| TypeScript package | package-local test, `bun run check:ts` |
| Rust crate/native | `bun run test:rs`, `bun run check:rs`, native smoke if ABI changed |
| Python robomp/rpc | `bun run test:py`, `bun run lint:py` |
| Prompt/skill/command | frontmatter/layout check, behavior review, no code test unless runtime changed |
| UI/dashboard/web | package build/test, browser QA if user-facing |
| Release/install | native build, smoke, install-method checks |

## Command Map

Focused commands:

```bash
bun --cwd=packages/coding-agent test path/to/file.test.ts
bun --cwd=packages/ai test path/to/file.test.ts
bun --cwd=packages/agent test path/to/file.test.ts
bun --cwd=packages/natives test path/to/file.test.ts
bun run test:rs
bun run test:py
```

Broader gates:

```bash
bun run fmt:ts
bun run lint:ts
bun run check:ts
bun run check:rs
bun run check
bun run test:ts
bun run test
```

Native/release gates:

```bash
bun run build:native
bun run ci:test:smoke
bun run ci:test:install-methods
```

Python gates:

```bash
bun run lint:py
bun run test:py
```

## Rules

- Do not run `tsc` or `npx tsc`.
- Use repo scripts before direct tool invocations.
- Run package-local tests before full-suite tests.
- Do not claim fixed until the failing command was rerun.
- If a command fails, stop broadening and inspect the first actionable failure.
- For docs/skills-only changes, verify discovery layout and frontmatter instead of pretending a build proves prose.
- For generated files, verify the generator source and regeneration path.

## Skills Frontmatter Check

Pi discovers skills one level under `skills/` for extension packages:

```text
skills/<skill-name>/SKILL.md
```

Each `SKILL.md` needs `name` and `description` frontmatter. In this package,
skill names must use the `hkx-` prefix.

## Report

Use exact status words:

- changed locally
- formatted
- verified locally
- not run
- blocked

Include commands and outcomes, not just "tests pass".
