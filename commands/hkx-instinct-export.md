---
name: hkx-instinct-export
description: "Export project/global instincts to a portable UTF-8 LF markdown bundle."
argument-hint: "[--scope project|global|all] [--output file] [--domain d] [--min-confidence n]"
---

# /hkx-instinct-export

Export instincts for backup or sharing.

## Linux / macOS / Git Bash

```bash
node scripts/instinct/cli.mjs export
node scripts/instinct/cli.mjs export --scope project --output ./instincts-export.md
node scripts/instinct/cli.mjs export --domain testing --min-confidence 0.7 --json
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs export --scope project --output .\instincts-export.md
```

## Notes

- Default scope is all (project + global merge for listing; project wins on id in store, but export with `--scope project|global` is pure)
- Output is UTF-8 LF multi-frontmatter markdown
