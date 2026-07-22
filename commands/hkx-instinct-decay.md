---
name: hkx-instinct-decay
description: "Preview or apply weekly confidence decay on inactive instincts (ECC -0.02/week model)."
argument-hint: "[--apply] [--rate 0.02] [--floor 0.1] [--as-of YYYY-MM-DD] [--scope project|global|all]"
---

# /hkx-instinct-decay

Time-based confidence decay for instincts that have not been active.

## Model (ECC parity)

From continuous-learning-v2 observer:

- **−0.02** confidence per **full week** without activity
- Partial weeks do not decay
- Default **floor = 0.1** (does not go to zero)

Activity timestamp precedence:

1. `last_seen` (optional frontmatter)
2. `updated`
3. `created`
4. file mtime

## Linux / macOS / Git Bash

```bash
# Preview only (default)
node scripts/instinct/cli.mjs decay
node scripts/instinct/cli.mjs decay --json

# Apply after review
node scripts/instinct/cli.mjs decay --apply

# Custom rate / floor / as-of (for audits)
node scripts/instinct/cli.mjs decay --rate 0.02 --floor 0.1 --as-of 2026-07-22 --apply
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs decay
node .\scripts\instinct\cli.mjs decay --apply
```

## What to do

1. Run preview; list id, old→new confidence, weeks inactive, activity source
2. Confirm with user before `--apply`
3. After apply, re-run `/hkx-instinct-status` and optionally `/hkx-evolve`
4. Prefer setting `last_seen` or `updated` when an instinct is reconfirmed (accept/from-om/export do not auto-refresh last_seen yet)

## Notes

- Only rewrites **single-instinct** files (one frontmatter block per file)
- Multi-instinct files are skipped with a reason
- Does not delete instincts; only lowers confidence
