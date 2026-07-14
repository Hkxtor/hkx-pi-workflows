---
name: hkx-config-gc
description: Confirm-each-deletion garbage collection for .pi/ and ~/.pi/ redundant, stale, orphaned, or low-value config. Use only after inventory/stocktake when the user wants cleanup ("config GC", "too many skills"). Not a read-only audit—prefer workspace-surface-audit / skill-stocktake / automation-audit-ops first. Never delete without explicit confirmation.
origin: HKX-converted-for-Pi
---

# HKX Config GC — Garbage Collection for Pi Setups

Borrowed from runtime garbage collection: periodically scan for objects that are no longer referenced, redundant, expired, or low-value, and reclaim the space. The critical difference: **here, collection requires a human in the loop. Never delete autonomously.**

## When to Activate

- The user asks to clean up, audit, or slim down their Pi configuration
- The user complains about too many skills, noisy hooks, or slow session startup
- A monthly/periodic config review is due
- After installing a large skill pack, to reconcile overlaps with existing setup

Do NOT activate for: cleaning project source code (that's refactoring), clearing chat history, or uninstalling Pi itself.

## Design Philosophy

1. **Append-only configs leak.** Skills, memory files, hooks, and permission entries only ever get added. Without periodic review they rot silently.
2. **Regular audits beat one-time purges.** Scan every ~30 days, propose a small batch of candidates each time.
3. **Per-channel strategies.** Each accumulation type has its own staleness signals — don't apply one rule everywhere.
4. **Soft-delete first.** Rename to `.disabled` > move to `_gc_trash/` > real deletion. Always keep an undo path.
5. **Forced human-in-the-loop.** Every candidate gets its own `[y/n/skip]` confirmation. No "yes to all" shortcut.
6. **Keep a log.** Every GC run appends to `.pi/gc_log.md`: what was touched, why, and how to undo it.

## Scan Channels

| # | Channel | Path | Staleness / redundancy signals |
|---|---------|------|--------------------------------|
| 1 | Skills | `.pi/skills/*/` or `~/.pi/skills/*/` | Heavily overlapping names; domain mismatch with the user's actual work; broken or empty SKILL.md |
| 2 | Memory | `.pi/memory/*.md` + its index | Multiple index entries for one topic; contents contradicting newer entries; dates that have passed; orphan files missing from the index; sub-100-word fragments that should merge |
| 3 | Hooks | `.pi/hooks/` + settings | Scripts present on disk but referenced by no hook config; old versions superseded by rewrites |
| 4 | Permissions | `permissions.allow` in settings | Duplicate entries; specific entries already covered by a wildcard; one-off grants from past experiments |
| 5 | MCP servers | `.mcp.json` or project `.mcp.json` | Servers that fail to connect; functional duplicates; long-unused |
| 6 | Commands | `.pi/commands/*/` | Commands that duplicate built-in Pi behavior; commands with broken skill/tool references |
| 7 | Rules | `.pi/rules/` | Rules that contradict project AGENTS.md; rules with stale references |
| 8 | Runtime caches | `.pi/cache/`, `.pi/logs/` | Sort by size and mtime; propose items >30 days old and large |

## Workflow

1. **Scan** all channels (or the subset the user names). Collect candidates with: path, channel, signal that flagged it, size, last-modified.
2. **Rank** by confidence (broken/orphaned = high; merely old = low) and present as a numbered table. Cap each run at ~20 candidates — GC is periodic, not exhaustive.
3. **Confirm one by one.** For each candidate show the evidence, then ask `[y/n/skip]`. The user can stop at any point.
4. **Soft-delete confirmed items**: prefer `.disabled` rename for skills/hooks and `_gc_trash/<date>/` move for files. Permission entries live in JSON (no comments possible): back up the settings file, record each removed entry verbatim in `gc_log.md`, then remove it from the `allow` array. Only hard-delete when the user explicitly asks.
5. **Log** the run to `.pi/gc_log.md`: timestamp, items actioned, undo instructions.
6. **Report**: reclaimed size, channels still healthy, suggested next review date.

## Pi Tooling

Use Pi tools for scanning:

- `find` for file presence and age-based filtering.
- `search` for cross-references, duplicate names, and orphan detection.
- `read` for content inspection and contradiction checks.
- `ask` for each confirm-each-deletion decision.

## Anti-Patterns

- **Bulk approval.** Asking "delete all 15? [y/n]" defeats the design. One item, one decision.
- **Hard-deleting on first pass.** If there's no `_gc_trash/` copy or `.disabled` rename, you did it wrong.
- **Treating "old" as "dead".** A skill untouched for 60 days may be seasonal. Age is a signal, not a verdict — that's why a human confirms.
- **Cleaning memory by truncation.** Merging two contradicting memory files requires reading both and keeping the newer truth.
- **Touching anything outside `.pi/` or the project's `.pi/`.** Config GC never wanders into source trees.

## Best Practices

- Run after big additions, not just on a calendar: installing a large skill pack is exactly when overlap appears.
- When two skills overlap, prefer disabling the one with the weaker trigger description.
- Permission cleanup is the highest-value channel per minute spent: redundant allow-entries make security review harder.
- Keep `gc_log.md` forever. It's tiny, and "when did I disable that hook and why" comes up more often than you'd think.

## Complementary Skills

- `hkx-workspace-surface-audit` — the additive counterpart: recommends what to install or enable. Config-gc is the subtractive half of the same lifecycle. Run audit first to see what's missing, then gc to clean what's stale.
- `hkx-security-review` — pairs well with the permissions channel.
