---
name: hkx-gateguard
description: Pi fact-forcing pre-action gate that requires concrete repository evidence before risky edits, new files, commands, or destructive actions.
origin: HKX-converted-for-Pi
---

# HKX GateGuard For Pi

Use this as an operator discipline before actions where guessing would damage code, data, config, or external systems.


## Evidence

Two independent A/B tests, identical agents, same task:

| Task | Gated | Ungated | Gap |
|---|---|---|---|
| Analytics module | 8.0/10 | 6.5/10 | +1.5 |
| Webhook validator | 10.0/10 | 7.0/10 | +3.0 |
| **Average** | **9.0** | **6.75** | **+2.25** |

Both agents produce code that runs and passes tests. The difference is design depth.
GateGuard is not self-evaluation. Do not ask “am I sure?” Require facts that force the model to inspect the repository and current user instruction.

## Triggers

- Editing a file that is imported, configured, generated, or used by multiple modules.
- Creating a new helper, adapter, command, skill, rule, agent, MCP entry, extension, or dependency wrapper.
- Changing data formats, schemas, migrations, fixtures, timestamps, serialization, or persisted files.
- Running a command that writes files, deletes data, rewrites history, publishes, deploys, bills, or mutates external systems.
- Any moment where the plan depends on “probably” instead of observed evidence.

## Gate Questions

### Before editing an existing file

```text
Before editing <path>:
1. Which files import, call, configure, or document this file?
2. Which public functions, classes, commands, routes, schemas, or exports can be affected?
3. If data is read or written, what are the observed fields, structure, and date/ID formats? Use redacted or synthetic examples.
4. What exact user instruction authorizes this change?
5. What focused verification will prove the change?
```

### Before creating a new file

```text
Before creating <path>:
1. What existing file or pattern is closest, and why is reuse insufficient?
2. Which file, command, skill, rule, agent, config, or user flow will call or load this new file?
3. What naming/frontmatter/schema convention must it follow?
4. What exact user instruction authorizes the new surface?
5. What validator or focused check will cover it?
```

### Before risky commands or external mutation

```text
Before running <action>:
1. What files, data, branches, services, accounts, or users can be modified?
2. Is the target local, test, staging, or production?
3. What rollback or recovery path exists?
4. What exact user instruction authorizes this action?
5. What evidence will confirm success?
```

## Pi Tooling

Use Pi tools to gather facts:

- `find` for file presence and naming patterns.
- `search` for imports, references, configs, and docs.
- `read` for exact local context and schemas.
- `lsp` for symbol references when available.
- `ask` only when the missing fact is a product decision or authorization that tools cannot provide.

## Anti-Patterns

- Replacing evidence with confidence language.
- Creating a compatibility shim because callsites were not searched.
- Adding a helper before checking local utilities.
- Running broad commands without knowing what they verify.
- Treating logging, retries, or defaults as fixes for unknown failure modes.
- Letting identical gate denials accumulate in long sessions. After the first few full denials, condense later denials to a single line carrying the denial ordinal to prevent context window bloat and model repetition loops.

## Output

```text
Gate:
Facts gathered:
Risk:
Authorization:
Verification:
Proceed / stop:
```
