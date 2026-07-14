---
name: hkx-code-tour
description: Create reusable CodeTour-style walkthrough artifacts with verified repository file and line anchors.
origin: HKX-converted-for-Pi
---

# HKX Code Tour For Pi

Use this when the user wants a reusable guided walkthrough of a codebase area, architecture path, PR, RCA, onboarding route, or security boundary.

Do not use this for a one-off chat explanation. Answer directly unless the user wants an artifact.

## Output Location

Default to `.tours/<persona>-<focus>.tour` for CodeTour-compatible artifacts unless the repository documents another tour path. Create only the tour file; do not modify source code.

## Workflow

1. **Discover**
   - Use `find` for repo roots, docs, manifests, entry points, and relevant changed files.
   - Use `search` for symbols, routes, errors, trust boundaries, or feature names.
   - Use `read` to verify exact files and line ranges before writing anchors.
2. **Choose reader and scope**
   - `new-joiner`: onboarding path, 9-13 steps.
   - `architect`: system boundaries and data flow, 12-18 steps.
   - `pr-reviewer`: changed files and review path, 7-11 steps.
   - `rca-investigator`: failure path and fix evidence, 7-11 steps.
   - `security-reviewer`: trust boundaries and controls, 7-11 steps.
   - `feature-explainer`: one feature end to end, 7-11 steps.
3. **Build the narrative**
   - Start with a real file or directory anchor.
   - Order steps so each explains why the next step matters.
   - Prefer file and selection anchors over content-only steps.
   - End with next actions, verification, or related areas.
4. **Validate anchors**
   - Every path exists.
   - Every line or selection is in range.
   - Titles are specific and short.
   - Descriptions explain purpose, not just file contents.

## Step Shapes

```json
{ "directory": "src/services", "title": "Service Layer", "description": "Business orchestration starts here." }
```

```json
{ "file": "src/auth/middleware.ts", "line": 42, "title": "Auth Gate", "description": "Protected requests pass through this check before handlers run." }
```

```json
{
  "file": "src/core/pipeline.ts",
  "selection": {
    "start": { "line": 15, "character": 0 },
    "end": { "line": 34, "character": 0 }
  },
  "title": "Request Pipeline",
  "description": "This block wires validation, authorization, and downstream execution."
}
```

## Guardrails

- Never guess line numbers.
- Do not use content-only steps as the opening step.
- Do not create tours for generated, vendored, or ignored code unless the user explicitly asks.
- Do not turn a broad onboarding need into a tour when a README or codemap is the better artifact.
- Keep tours concise enough to be followed in one sitting.

## Output

```text
Tour:
Persona:
Scope:
Steps:
Anchors verified:
File written:
Residual gaps:
```
