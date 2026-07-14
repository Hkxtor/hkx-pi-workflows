---
name: hkx-recipes
description: Browse or match Pi workflow command recipes. Shows all command families with run-order and stop conditions, or maps a workflow description to the right command sequence.
argument-hint: "[workflow description | empty=list all]"
---

# /hkx-recipes — Pi Workflow Recipes

Browse or match Pi command-group recipes. Trigger the `hkx-ecc-recipes` skill for: `$ARGUMENTS`

## Behavior

| Input | Mode |
|---|---|
| Empty | **Catalog mode** — list all command families with member counts, meanings, and typical run-order |
| Description (e.g. "fix a bug in my Go service") | **Match mode** — map the workflow to the best command sequence with run-order and stop condition |

## Process

1. Live-read command names from the `commands/` directory.
2. Classify into families by prefix.
3. In catalog mode, output the family table.
4. In match mode, output the run-order block and stop condition.

## Advisory Only

This command only describes what to run — it does not execute any matched commands. For execution, invoke the recommended command directly.

## Output Format (Match Mode)

```
Workflow: <one-sentence restatement>

Best fit: <family> — <why>

Run-order:
  /<cmd1>   # job
  /<cmd2>   # job
  STOP when: <condition>
```

---

*Part of HKX Pi Workflows*
