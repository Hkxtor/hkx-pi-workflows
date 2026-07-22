---
name: hkx-instinct-import
description: "Import instincts from a bundle file or ECC homunculus directory tree."
argument-hint: "<file> | --from-ecc <dir> [--dry-run] [--scope project|global]"
---

# /hkx-instinct-import

Import instincts into personal (file) or inherited (ECC tree) buckets.

## Linux / macOS / Git Bash

```bash
node scripts/instinct/cli.mjs import ./instincts-export.md --dry-run
node scripts/instinct/cli.mjs import ./instincts-export.md
node scripts/instinct/cli.mjs import --from-ecc ~/.local/share/ecc-homunculus --scope global --dry-run
node scripts/instinct/cli.mjs import --from-ecc /path/to/ecc-homunculus --scope project
```

## Windows PowerShell

```powershell
node .\scripts\instinct\cli.mjs import .\instincts-export.md --dry-run
node .\scripts\instinct\cli.mjs import .\instincts-export.md
```

## Behavior

- Dedupes by id (keeps higher confidence from source)
- Updates only when incoming confidence is higher
- `--dry-run` never writes
- ECC tree import uses inherited/ bucket
