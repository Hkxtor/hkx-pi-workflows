---
name: hkx-ecc-recipes
description: Map a described workflow to the right Pi command group with run-order and stop condition, and browse all command-group recipe families. Adds family-grouping, run-order, and when-to-stop on top of the flat command catalog. Advisory only.
version: 1.0.0
origin: ECC-converted-for-Pi
---

# HKX ECC Recipes

One entry point for "which group of Pi slash-commands runs my workflow, in what order, and when do I stop." Also browses every command-group recipe family.

This skill adds **family grouping + run-order + stop condition** on top of a flat command catalog.

## When to Activate

- "Which command group do I run for <workflow>?"
- "What's the command sequence to build an MVP / fix a defect / refactor?"
- "Show me all Pi command-group recipes" (catalog mode)
- "How many workflow pipelines does the project have?"
- User invokes `/hkx-recipes` with or without a description.

### Do Not Use When

- User wants the task done now — route to the actual command, don't describe it.
- User wants deep docs for ONE command — point at the command's markdown.

## Core Principle

**Answer from current files, not memory.** The command set changes; never hardcode counts or member lists. Read the live `commands/` directory each run, then classify into families.

### Live reads

List command files in the Pi commands directory using `glob` or `bash`:

```bash
ls commands/*.md 2>/dev/null | xargs -n1 basename -s .md | sort
```

Optionally read the README.md command table for descriptions. Use the smallest set of reads needed.

## Family Classification (by prefix)

Group command names by leading prefix; map known singletons by hand. Families are derived live — the table below is the classification rule, not a frozen list.

| Family prefix | Recipe meaning | Typical run-order |
|---|---|---|
| `hkx-orch-*` | Gated research, TDD, review, commit per task type | Pick one `hkx-orch-*` by task kind; it runs its own internal phases |
| `hkx-build-*` / `hkx-review-*` / `hkx-test-*` | Per-language CI triad | Fix → Review → Test in the relevant language |
| `hkx-update-*` | Doc or codemap refresh | Read current state → update → verify |
| `hkx-plan*` | Planning and PRD drafting | `/hkx-plan-prd` then `/hkx-plan` or standalone |
| singletons | `hkx-workflow`, `hkx-quality-gate`, `hkx-security-scan`, etc. | Standalone or glue between groups |

Any command not matching a prefix rule → list it under **singletons** with its one-line description from frontmatter.

## How It Works

```
1. Live-read command names from commands/ directory.
2. Classify into families by prefix and a singleton map.
3. If a workflow description was given → MATCH MODE.
   If none → CATALOG MODE.
4. Advisory only: print the plan. Never run the matched commands.
```

### Catalog mode (no description)

Output the family table: each family, member count, members, one-line meaning, typical run-order. End with the total command count and a prompt to describe a workflow for a matched recipe.

### Match mode (description given)

1. Restate the workflow in one sentence.
2. Pick the best 1-2 families; say WHY in one line each.
3. **Run-order block** — exact command sequence for the matched family.
4. **Stop condition** — always explicit (completion signal, review passes, or single-shot).
5. **Where to read** — the `commands/<name>.md` path for each command.

## Output Template (match mode)

```
Workflow: <one-sentence restatement>

Best fit: <family> — <why>
(Alt: <family> — <why>)

Run-order:
  /<cmd1>   # job
  /<cmd2>   # job
  /<cmd3>   # job
  STOP when: <condition>

Read full docs:
  commands/<cmd1>.md
```

## Examples

**Catalog:** `/hkx-recipes` → prints the family table and total count.

**Match:** `/hkx-recipes plan and implement a feature` → Best fit: `hkx-workflow` (research, plan, execute, verify, review). Run-order: `/hkx-workflow plan a feature` then work through phases. STOP: all gates pass and review approved.

**Match:** `/hkx-recipes fix a build issue` → Best fit: `hkx-build-fix` (detect and fix incrementally). Run-order: `/hkx-build-fix`. STOP: build passes.

## Non-Goals

- Not an executor — advisory only.
- Not per-command deep docs.
- Never hardcode command counts or member lists — always live-read.
