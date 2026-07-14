---
description: "Run an Pi-native HKX development workflow: research, plan, execute, verify, and review."
argument-hint: "[task description]"
---

# HKX Workflow For Pi

Run a structured development workflow for: `$ARGUMENTS`

## Operating Model

You are the orchestrator. Keep the main session as the only writer. Use Pi-native tools and in-process agents for research, design, and review. Do not call external wrapper CLIs or assume any non-Pi session store.

Use this sequence:

1. Research
2. Ideation
3. Plan
4. Execute
5. Verify
6. Review

If `$ARGUMENTS` is empty, ask for the task before doing work.

## Phase 1: Research

Gather local evidence first:

- Read `AGENTS.md` and relevant `.pi/` guidance when present.
- Search for existing implementations, tests, commands, skills, and docs in the affected area.
- Identify naming, error handling, logging, data access, and test patterns.
- If the work spans multiple subsystems, use Pi `eval` helpers when available:
  - `agent(...)` for focused subsystem reads
  - `parallel(...)` for independent exploration

Stop and ask only when the task cannot be scoped from local context.

## Phase 2: Ideation

Produce two or three viable approaches. Score each on:

- Fit with existing patterns
- Testability
- Blast radius
- User-facing risk
- Operational complexity

Pick one approach and explain why.

## Phase 3: Plan

Before writing code, present a concise implementation plan with:

- Requirements restatement
- Files to change
- Task order
- Validation commands
- Risks and mitigations

Wait for explicit user approval before edits unless the user has already asked to proceed.

## Phase 4: Execute

Implement narrowly:

- Prefer existing helpers and local architecture.
- Keep unrelated refactors out.
- Add tests where the change creates or protects a real contract.
- Avoid external network or third-party writes unless the user explicitly approves.

## Phase 5: Verify

Run the smallest meaningful validation set first, then broaden if shared behavior changed:

- Targeted tests
- Type check or build
- Lint or formatting check
- Security scan for secrets and risky patterns when applicable

Record commands and results.

## Phase 6: Review

Review the diff before final response:

- Confirm no unrelated files changed.
- Confirm Pi-specific paths are used.
- Confirm no stale source-tool instructions remain.
- Summarize changes, validation, and residual risks.

## Completion

Return:

- What changed
- Validation run
- Any skipped checks and why
- Recommended next step
