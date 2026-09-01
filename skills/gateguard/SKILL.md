---
name: gateguard
description: Pi destructive-command hard gate. Blocks destructive shell commands until the operator states scope, target environment, rollback path, and authorization. Formerly also gated first-per-file edits; that gate was retired after A/B re-testing showed zero benefit on current models.
origin: HKX-converted-for-Pi
---

# HKX GateGuard For Pi

GateGuard is now a **destructive-command hard gate**, not an investigation
forcer. It intercepts shell commands that can destroy data or history and
refuses them until the operator confirms the action deliberately.

## Evidence

**2026-08 A/B retest (current models) — first-edit gate: no effect.**

Rebuilt the two lost original tasks on a fixture repo with mandatory-convention
helpers (`src/lib/` reuse, `AppError` errors, redacted logging). Same executor
model (`gpt-5.6-sol`) ran each task twice: once with the real
`extensions/hkx-gateguard.ts` loaded, once without. A different model
(`grok-4.6`) scored anonymized diffs blind against a reuse/convention rubric:

| Task | Gated | Ungated | Gap |
|---|---|---|---|
| Analytics module | 7.0 | 7.0 | 0.0 |
| Webhook validator | 10.0 | 10.0 | 0.0 |
| **Average** | **8.5** | **8.5** | **0.0** |

Both arms reused the same helpers and converged on near-identical
implementations. The historical +2.25 gap was measured on older models whose
dominant failure mode was editing without reading; current models investigate
before editing on their own. The first-edit gate was removed in the same
change.

What remains valuable is orthogonal to model strength: destructive commands
are a **policy** concern (irreversibility), not an intelligence deficit.

## What The Gate Does

`extensions/hkx-gateguard.ts` hooks `tool_call`:

- **bash + destructive pattern → block.** Patterns cover `rm` (except `/tmp/`),
  history-rewriting/force git ops, `drop/delete from/truncate` SQL, `mkfs`,
  `dd of=`, `format`, `kill -9`, `pkill`, `sudo rm`. The denial message asks
  the four gate questions below; after the third denial messages condense to
  one line.
- **False-positive masking.** Before matching, single/double-quoted strings,
  backticks, and heredoc bodies are masked, so commands that merely *mention*
  destructive text (regex sources, `echo "git reset --hard"`, grepping the
  word `pkill`) are not blocked. When the remaining skeleton contains an
  eval-invoker (`bash -c`, `sh -c`, `eval`, `node -e`, `python -c`, `psql -c`,
  `perl -e`), the masked fragments are scanned too, so
  `bash -c 'rm -rf build/'` stays blocked while `echo 'rm -rf build/'` passes.
- **`.pi-subagents/` artifact writes are pre-authorized** once the command is
  provably non-destructive (MF1: destructive check always runs first).

Disable per session: `HKX_GATEGUARD=off`.

## Triggers

- The command deletes files/data, rewrites history, force-pushes, drops or
  truncates tables, kills processes, or formats devices.

## Gate Questions

Answer before retrying a blocked command:

```text
Before running <action>:
1. What files, data, branches, services, accounts, or users can be modified?
2. Is the target local, test, staging, or production?
3. What rollback or recovery path exists?
4. What exact user instruction authorizes this action?
```

## Known Limits

- The pattern list is a guardrail, not a security boundary: equivalents such
  as `find -delete`, `truncate -s0`, or interpreter one-liners are not
  statically recognizable, and quoted fragments are trusted unless re-executed
  by an eval-invoker.
- Blocked destructive commands have no in-session exemption path; an operator
  must either approve-and-rephrase or restart with `HKX_GATEGUARD=off`.
  (Candidate follow-up PRD: session-scoped "explain once, then allow".)

## Output

```text
Gate:
Facts gathered:
Risk:
Authorization:
Proceed / stop:
```
