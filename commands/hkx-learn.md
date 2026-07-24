---
name: hkx-learn
description: "Extract reusable patterns from the current session and save them as pending instincts for human review."
argument-hint: "[optional focus]"
---

# /hkx-learn — Extract session patterns → pending instincts

Focus (optional): `$ARGUMENTS`

Mine the current session for reusable patterns and save them as **pending** instincts. Do not auto-promote to personal/global.

## What to extract

1. **Error resolution** — root cause + fix + reuse condition
2. **Debugging techniques** — non-obvious tool sequences
3. **Workarounds** — library/API/version quirks
4. **Project conventions** — architecture or integration patterns discovered here

Skip typos, one-off outages, and anything not likely to help a future session.

## Process

1. Review the session (and optional focus in `$ARGUMENTS`)
2. Pick the 1–3 highest-value patterns (prefer fewer, sharper instincts)
3. Draft each as an instinct:

```yaml
---
id: short-kebab-id
trigger: "when <situation>"
confidence: 0.6
domain: debugging|workflow|code-style|tooling|architecture
source: session-learn
scope: project
---

# Title

## Action
What to do next time.

## Evidence
What happened in this session that supports it.
```

Rules:

- `id`: `[a-z0-9][a-z0-9._-]*`
- one pattern per instinct
- body must not contain bare `---` fences that break frontmatter

1. Show drafts to the user and confirm before writing
2. Persist as **pending** (not personal):

```bash
# from hkx-pi-workflows package root (or wherever scripts/instinct lives)
node scripts/instinct/cli.mjs init

# write each pending instinct via the store API, e.g.
node --input-type=module -e '
import { resolveHomunculusDir, detectProject, ensureLayout } from "./scripts/instinct/lib/paths.mjs";
import { writeInstinct } from "./scripts/instinct/lib/store.mjs";
const { root } = resolveHomunculusDir();
const project = detectProject(process.cwd());
ensureLayout(root, project);
writeInstinct(root, project, {
  id: "example-id",
  trigger: "when ...",
  confidence: 0.6,
  domain: "debugging",
  source: "session-learn",
  scope: "project",
  content: "# Title\n\n## Action\n...\n\n## Evidence\n...",
}, "pending", "project");
console.log("wrote pending", "example-id");
'
```

If the instinct CLI/scripts are unavailable in this environment, write drafts to `.pi/learned/<id>.md` instead and tell the user how to import later.

1. Point next steps:

- `/hkx-instinct-status` / `status --pending`
- `/hkx-instinct-accept`
- `/hkx-evolve` after accept

## Output

```text
LEARN candidates: N

1. id=<id> domain=<d> trigger=<...>
   why: <one line>

Wrote: pending | .pi/learned fallback
Next: /hkx-instinct-accept then /hkx-evolve
```

## Related

- quality-gated variant: `/hkx-learn-eval`
- OM file import: `/hkx-instinct-from-om`
- skill: `instinct-evolve`
