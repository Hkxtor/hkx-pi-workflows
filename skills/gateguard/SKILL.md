---
name: gateguard
description: Pi destructive-command hard gate. Unconditionally blocks matched shell commands while enabled; use a non-destructive alternative or restart with HKX_GATEGUARD=off after explicit authorization.
origin: HKX-converted-for-Pi
---

# HKX GateGuard For Pi

GateGuard is a **destructive-command hard gate**. It intercepts shell commands
that can destroy data or history and rejects them while the gate is enabled.
There is no in-session exemption for a matched command.

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
Disable before starting or restarting a session: `HKX_GATEGUARD=off`.

## Triggers

- The command deletes files/data, rewrites history, force-pushes, drops or
  truncates tables, kills processes, or formats devices.

## Decision Checklist

Use these questions to choose whether to stop, use a non-destructive
alternative, or restart with the gate disabled. Answering them does not unlock
the blocked command in the current session.

```text
Before choosing a path:
1. What files, data, branches, services, accounts, or users can be modified?
2. Is the target local, test, staging, or production?
3. What rollback or recovery path exists?
4. What exact user instruction authorizes disabling the gate, if needed?
```

## Known Limits

- The pattern list is a guardrail, not a security boundary: equivalents such
  as `find -delete`, `truncate -s0`, or interpreter one-liners are not
  statically recognizable, and quoted fragments are trusted unless re-executed
  by an eval-invoker.
- Blocked destructive commands have no in-session exemption path. Replace the
  command with a genuinely non-destructive alternative, stop, or restart with
  `HKX_GATEGUARD=off` after explicit operator authorization.

## Output

```text
Gate:
Scope and risk:
Authorization:
Decision: safe alternative / disable-and-restart / stop
```
