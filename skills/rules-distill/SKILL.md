---
name: rules-distill
description: Scan installed skills and distill recurring cross-cutting principles into rule files — append, revise, add a section, or create a new rule. Use for periodic rules maintenance, after a skill-stocktake, or when the same principle keeps reappearing across skills and belongs in a rule instead.
origin: ECC-converted-for-Pi
---

# HKX Rules Distill

Scan installed skills, extract principles that recur across multiple skills, and
distill them into rules — appending to an existing rule, revising inaccurate
content, adding a section, or creating a new rule file.

Principle: **deterministic collection, LLM judgment.** Collection is exhaustive and
mechanical; only the cross-read verdict needs a model.

## When to Use

- Periodic rules maintenance (monthly, or after pulling or adding new skills).
- After `skill-stocktake` surfaces patterns that belong in rules rather than skills.
- When rules feel thin relative to the skills actually in use.

## When Not To

- The principle appears in exactly one skill — it stays in that skill.
- The content is a code example, command, or framework-specific recipe — that is
  skill territory, not rule territory.
- The rule would duplicate `rules/hkx-common-*` in different words.

## Phase 1 — Inventory (deterministic)

Collect facts before judging anything.

```bash
# skill inventory
find skills -maxdepth 2 -name SKILL.md | sort

# one-line descriptions for thematic clustering
ffgrep -n '^description:' skills/*/SKILL.md

# rules inventory + heading index
find rules -maxdepth 1 -name '*.md' | sort
ffgrep -n '^#\{1,3\} ' rules/*.md
```

Report:

```text
Rules Distillation — Phase 1
Skills: <N> files
Rules:  <M> files (<K> headings indexed)
```

## Phase 2 — Cross-Read and Verdict

Rules are small (a few hundred lines total). Read the **full text** of all rule
files rather than grep-filtering them; a principle already covered in different
words is the most common false positive.

Group skills into thematic clusters by description (agent/harness, engineering
process, language, ops, domain). Judge a cluster at a time.

Context isolation only matters here when the skill set is genuinely large: if
`skills/` is under roughly 80 entries, cross-read in the main loop; beyond that,
delegate one read-only pass per cluster to `hkx.code-explorer` and merge verdicts
afterwards — the collection is mechanical, so nothing is lost by isolating it.

### Inclusion filter

Include a candidate only if **all** hold:

1. **Appears in 2+ skills.** One skill means it stays a skill.
2. **Actionable behavior change.** Writable as "do X" / "don't do Y" — not "X is
   important".
3. **Named violation risk.** One sentence on what goes wrong if ignored.
4. **Not already in rules.** Including paraphrases.

### Verdicts

| Verdict | Meaning |
| --- | --- |
| `Append` | Add to an existing section of an existing rule file |
| `Revise` | Existing rule content is wrong or insufficient — propose before/after |
| `New Section` | Add a new section to an existing rule file |
| `New File` | Create a new rule file |
| `Already Covered` | Covered already, possibly worded differently |
| `Too Specific` | Should stay at skill level |

Per candidate:

```json
{
  "principle": "1-2 sentences in do / don't form",
  "evidence": ["skill-name", "skill-name"],
  "violation_risk": "1 sentence",
  "verdict": "Append | Revise | New Section | New File | Already Covered | Too Specific",
  "target_rule": "hkx-<name>.md §Section, or 'new'",
  "confidence": "high | medium | low",
  "draft": "Proposed rule text",
  "revision": {
    "reason": "Why existing content is wrong (Revise only)",
    "before": "Current text",
    "after": "Replacement text"
  }
}
```

### Exclusions

- Language- and framework-specific knowledge belongs in `hkx-<lang>.md` or a skill,
  not in `hkx-common-*`.
- Commands, code samples, and file paths belong in skills.
- Anything about *when to run checks* belongs in a skill or `AGENTS.md`, not a rule.

## Phase 3 — Review and Apply

`rules/` files are loaded by the `hkx-rules` extension and some carry `globs`
frontmatter that makes them auto-activate on matching files. A bad rule is injected
into every future session, so:

**Never write to `rules/` without explicit operator approval.**

1. Present a summary table:

```text
# Rules Distillation Report
Skills scanned: <N> | Rules: <M> files | Candidates: <K>

| # | Principle | Verdict | Target | Confidence |
|---|-----------|---------|--------|------------|
```

2. Show per-candidate detail (evidence, violation risk, draft).
3. Operator replies with numbers — approve, modify, or skip.
4. Apply only approved candidates, one file edit at a time.

### Rule file shape

```markdown
---
description: One line naming the surface this rule governs.
globs:
  - "**/*.{ts,tsx}"
---

# HKX <Surface> Guidance

Use this rule when <trigger>.

## <Section>
- Actionable bullet.
```

Keep `globs` narrow — a rule with no business matching a file type should omit it.
Check `docs/language-hooks.md` before adding a rule; if the constraint can be
enforced mechanically, an extension or Hookify rule beats prose.

## Anti-Patterns

- Auto-writing rules during the run. Approval is mandatory.
- Promoting a single-skill principle "because it sounded general".
- Emitting rules that restate `hkx-common-coding-style` in new words.
- Letting rule files grow without pruning — run `skill-stocktake` alongside this to
  retire stale entries.
- Treating an `Already Covered` verdict as failure; it is the expected outcome.

## Validation

```bash
npm run validate
```

Frontmatter `description` is required on every rule file. If a rule is retired,
confirm no dangling `~/.pi/agent/rules/` symlink survives the install.
