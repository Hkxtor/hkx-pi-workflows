---
description: Generate or refresh token-lean architecture codemaps from local repository evidence.
argument-hint: "[area | blank for repo-wide scan]"
---

# HKX Update Codemaps For Pi

Codemap target: `$ARGUMENTS`

Generate compact architecture maps that help future Pi agents understand the repo without re-reading large source trees.

## Output Location

Default to `docs/CODEMAPS/` unless the repository already has a documented codemap location. Do not use hidden or user-specific paths.

Recommended files:

| File | Contents |
|---|---|
| `docs/CODEMAPS/INDEX.md` | Repo shape, packages, entry points, and links to area maps |
| `docs/CODEMAPS/backend.md` | APIs, services, repositories, jobs, and data flow |
| `docs/CODEMAPS/frontend.md` | Routes, pages, components, state, and UI data flow |
| `docs/CODEMAPS/data.md` | Schemas, migrations, stores, queues, and cache surfaces |
| `docs/CODEMAPS/integrations.md` | External services, MCPs, SDKs, webhooks, and credentials surfaces |

Only create files that match the repository evidence. Do not invent frontend, backend, or data maps for repos that lack those surfaces.

## Workflow

1. **Discover repo shape**
   - Use `find` for package manifests, source roots, apps, packages, services, docs, tests, and config.
   - Use `read` for manifests and documented entry points.
   - Use `search` for routes, exported commands, tools, schemas, migrations, jobs, and integrations.
2. **Map architecture**
   - Identify entry points, package boundaries, runtime surfaces, generated files, data stores, and test gates.
   - Prefer file paths, exported symbols, route names, and short dependency notes over prose.
3. **Refresh codemaps**
   - Keep each codemap token-lean and link to exact files.
   - Include a freshness header:
     `<!-- Generated: YYYY-MM-DD | Evidence: local repo scan | Scope: <area> -->`
   - Preserve manually maintained sections unless the file clearly marks a generated block.
4. **Handle existing codemaps**
   - Read existing codemaps first.
   - If the update is large, summarize the change before overwriting and ask when it changes interpretation rather than freshness.
5. **Report**
   - List files created/updated, evidence used, skipped areas, and residual unknowns.

## Codemap Style

```markdown
# <Area> Codemap

<!-- Generated: YYYY-MM-DD | Evidence: local repo scan | Scope: <area> -->

## Entry Points
- `path/to/file.ts` — purpose

## Boundaries
- `package-or-module` owns <responsibility>

## Flow
Request/event → handler → service → adapter/store → response/effect

## Key Files
| File | Purpose | Notes |
|---|---|---|

## Verification
- `<repo command>` — what it proves
```

## Guardrails

- Never claim generated diagrams or maps are complete beyond inspected evidence.
- Do not install scanners or graph tools for this command.
- Do not include secrets, private values, or production payloads.
- Keep maps maintainable: update the map when it helps future work; do not mirror every file.
