---
description: "Linux and Windows data roots, CLI invocation, and path rules for instinct-evolve."
---

# Platforms (Linux / Windows)

## Data root

| OS | Default |
| --- | --- |
| Linux | `$XDG_DATA_HOME/hkx-homunculus` or `~/.local/share/hkx-homunculus` |
| Windows | `%LOCALAPPDATA%\hkx-homunculus` |
| Override | `HKX_HOMUNCULUS_DIR` must be **absolute** |

## Invocation

```bash
# Linux / macOS / Git Bash
node scripts/instinct/cli.mjs status
HKX_HOMUNCULUS_DIR=/tmp/hkx-h node scripts/instinct/cli.mjs evolve
```

```powershell
# Windows PowerShell
node .\scripts\instinct\cli.mjs status
$env:HKX_HOMUNCULUS_DIR="D:\data\hkx-h"
node .\scripts\instinct\cli.mjs evolve --generate
```

## Rules

- Node ESM only (no Python, no bash-required path)
- Paths via `node:path` / `os.homedir()`
- Project id prefers git remote URL (stable across OS)
- Path-based ids normalize drive letter and separators on win32
- Atomic writes tolerate Windows replace semantics
- CLI messages are ASCII-safe

## WSL

Run the CLI in the **same environment as Pi**. Do not mix Windows `%LOCALAPPDATA%` paths with WSL home without an explicit override.
