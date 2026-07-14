---
description: Run project validation gates and summarize build, type, lint, test, security, and diff status.
argument-hint: "[optional scope or command]"
---

# HKX Quality Gate For Pi

Run quality gates for: `$ARGUMENTS`

## Gate Selection

Read project guidance first. Prefer commands from `AGENTS.md`, package scripts, CI config, or docs.

Common gates:

| Gate | Examples |
|---|---|
| Format | `bun fmt`, `cargo fmt --check`, `ruff format --check` |
| Lint | `bun lint`, `cargo clippy`, `ruff check` |
| Type or build | `bun check`, `cargo check`, `go test ./...` |
| Tests | Targeted tests first, broader suite if shared behavior changed |
| Security | Secret scan and dependency audit when available |

## Execution

1. List selected commands before running them.
2. Run the narrowest useful checks.
3. If a command fails, capture the meaningful tail and diagnose.
4. Do not perform networked installs or external writes without approval.

## Report

```text
Quality Gate
Build:     PASS/FAIL/SKIP
Types:     PASS/FAIL/SKIP
Lint:      PASS/FAIL/SKIP
Tests:     PASS/FAIL/SKIP
Security:  PASS/FAIL/SKIP
Diff:      files changed

Overall: READY / NOT READY
```

Include exact commands and any skipped checks.
