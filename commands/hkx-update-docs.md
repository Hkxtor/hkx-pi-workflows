---
description: Refresh repository documentation from local source-of-truth files without overwriting hand-written intent.
argument-hint: "[doc-area | blank for changed docs inventory]"
---

# HKX Update Docs For Pi

Documentation target: `$ARGUMENTS`

Update docs so they match local repository evidence. Prefer narrow, evidence-backed edits over broad generated documentation.

## Source Of Truth

Inspect only relevant local sources:

| Source | Documentation it can support |
|---|---|
| `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Makefile` | install, build, test, release, and script references |
| `.mcp.json`, `mcp-configs/`, extension manifests | MCP and extension loading docs |
| `scripts/validate.mjs`, CI configs, test configs | validation and quality gate docs |
| route files, tool definitions, command files, exported APIs | user-facing API or command references |
| env examples and sanitized config templates | configuration docs without secrets |
| `docs/conversion-map.md` | HKX-to-Pi migration status |

## Workflow

1. **Inventory docs and sources**
   - Use `find` for docs, manifests, commands, skills, rules, agents, extensions, scripts, and config.
   - Use `read` for the docs and source files that directly support the requested area.
2. **Decide update mode**
   - Patch an existing doc when it already owns the topic.
   - Create a new doc only when the user requested it or the repo has an established docs convention for that artifact.
   - Do not replace hand-written context with generated tables unless the section is clearly generated.
3. **Update from evidence**
   - Preserve manual sections.
   - Keep generated/reference sections compact.
   - Mark generated blocks when useful with comments such as `<!-- AUTO-GENERATED: <source> -->`.
4. **Check consistency**
   - Cross-check README, conversion map, validator, manifest, and command/skill/agent inventories when package surfaces change.
   - Verify referenced files and paths exist.
5. **Report**
   - List docs changed, sources inspected, docs intentionally left unchanged, and any stale areas needing human decision.

## Output

```text
Documentation update:
Updated:
Verified sources:
Skipped:
Stale or uncertain:
Next verification:
```

## Guardrails

- Do not document behavior that was not observed in files, tests, configs, or user-supplied product artifacts.
- Do not include secrets, private paths, tokens, credentials, or production examples.
- Do not run broad formatters or doc generators unless the repo already defines that exact workflow and it is needed.
- Keep docs Pi-native; remove HKX-specific wrapper, install, and session-store assumptions rather than preserving them.
