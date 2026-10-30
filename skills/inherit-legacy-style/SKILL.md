---
name: inherit-legacy-style
description: Prevent AI style drift on legacy projects by scanning the codebase for implicit conventions, resolving conflicts with the operator one at a time, and writing an enforceable .ai-style-rules.md (Golden Files, naming rules, DONTs) plus an optional AGENTS.md hook. Use when onboarding an agent onto a hand-written legacy codebase or extracting a project's unwritten coding rules.
origin: ECC-converted-for-Pi
---

# Inherit Legacy Style

Prevent AI code style drift in legacy projects: scan the codebase for implicit
conventions across four meta-architecture dimensions, resolve conflicts with the operator
one at a time, and crystallize the consensus into an enforceable `.ai-style-rules.md`.
Language- and framework-agnostic.

## When to Activate

- The user mentions onboarding an agent onto a hand-written legacy project.
- The user is worried AI-generated code will "drift" from existing conventions.
- The user wants to extract and codify the project's implicit coding rules.

## Prerequisites

- Git (recommended; non-Git projects fall back to file timestamps for incremental mode).
- Read/write access to the project root — the skill writes `.ai-style-rules.md` and
  optionally adds an `AGENTS.md` reference.

## Workflow

### Step 0 — Auto-detect mode

Silently check for `.ai-style-rules.md` at the project root:

| File exists? | Mode |
|---|---|
| No | **Branch A — first-time full scan** |
| Yes | **Branch B — incremental sniff** |

Announce the mode in one line and proceed — never ask the operator to pick.

### Branch A — First-time full scan

**1. Measure scale, pick a scanning tier**

```bash
git ls-files | grep -cE '\.(js|ts|jsx|tsx|vue|py|go|rs|java|kt|rb|php|cs|swift|c|cpp|h)$'
```

| Tier | Source files | Strategy |
|---|---|---|
| Small | ≲ 50 | Full close-read of every source file |
| Medium | 50–500 | Infrastructure layer = full read; business layer = sample 2–3 per dimension |
| Large | ≳ 500 | Strict sampling + budget cap; `--stat` summary first, then targeted reads |

**2. Scan along four dimensions**

1. **File anatomy** — in-file declaration order (imports → types → main logic → helpers →
   export).
2. **State and control flow** — naming conventions for async state, pagination, flags.
3. **Infrastructure** — where cross-cutting utilities live (interceptors, formatters,
   middleware).
4. **Error handling** — try/catch vs global interceptor vs `Result` return; null-check
   habits.

**3. Apply signal-threshold noise reduction**

Before interrupting the operator, evaluate signal strength:

- **Weak signal** → auto-suppress: minority < 5% **and** count < 10 → majority wins, the
  minority goes into DONTs.
- **Strong signal** → grill: near-even split, or a semantic fork on a core dimension.
- **Small-project exception**: sources ≲ 50, "3 vs 2" is **not** a majority → grill it.

**4. Resolve conflicts one at a time (grilling protocol)**

For each strong-signal conflict, present exactly ONE question with four options — in pi,
use `ask_user_question` so the options render as selectable rows:

> Evidence: `pathA` uses style X, `pathB` uses style Y
> Risk: mixing both fractures the project style
> Choose: `1` follow X · `2` follow Y · `3` this is evolution, update the rules ·
> `4` I have a new rule

Wait for the answer, then proceed to the next conflict. **Never stack questions.** This
is the same discipline as the `grilling` skill; load it if the conflict tree is deep.

**5. Generate `.ai-style-rules.md`** with three mandatory sections:

- **[Golden Files]** — real exemplar paths, each annotated with what it demonstrates
- **[Naming & State-Control Rules]** — concrete, checkable conventions
- **[DONTs]** — anti-patterns that must not propagate

**6. Install the persistent hook**

Ask for enforcement strength:

| Option | Mechanism |
|---|---|
| **1** Soft hook (recommended) | Add an `@.ai-style-rules.md` reference to the project `AGENTS.md` |
| **2** Hard hook | Soft hook + a `hookify` rule that blocks writes which violate a listed DONT |
| **3** No hook | Keep the rules file; the operator references it manually |

In pi the hard hook is a Hookify rule (see `hookify-rules`), not a `settings.json`
`PreToolUse` entry — the mechanism name differs, the intent does not.

### Branch B — Incremental sniff

1. Read the existing `.ai-style-rules.md`; if it carries a commit fingerprint, run
   `git diff <last_hash> HEAD --stat` to pinpoint the delta.
2. Read recent changes (`git log -3 --stat`, then inspect suspect files on demand).
3. For oversized diffs (hundreds of files): `--stat` summary only, plus a sample of the
   largest changes.
4. Compare new code against the recorded rules → conflicts go through the grilling
   protocol.
5. **Append** an evolution log to `.ai-style-rules.md`; never overwrite old rules.

### Per-turn enforcement

When `.ai-style-rules.md` is in context (loaded via `AGENTS.md`), every code-writing task
opens with a short compliance note naming the exemplar being followed and the DONTs being
avoided.

## Output

- `.ai-style-rules.md` at the project root, with commit fingerprint and scale tier in the
  header
- Optionally an `AGENTS.md` reference (`@.ai-style-rules.md`)
- Evolution entries appended as `### [YYYY-MM-DD] Style Evolution Log`

## Anti-Patterns

- **Do not skip the scale measurement.** Sampling a 30-file project starves it;
  full-scanning a 5,000-file repo blows the budget.
- **Do not stack conflict questions.** Grilling is strictly one at a time.
- **Do not overwrite old rules** in incremental mode — append evolution logs.
- **Do not default to the hard hook** without asking. Enforcement strength is the
  operator's call.
- **Do not judge syntax or tech-stack quality.** This skill aligns meta-architecture only.
- **Do not copy bugs from exemplar files.** Reuse structure; flag defects separately.

## Best Practices

- Announce the detected mode and scale tier in one line before scanning.
- For large projects, read `--stat` summaries first, then targeted reads on suspect files.
- Let the signal threshold handle noise — an 843-vs-8 naming split should auto-resolve
  without interrupting the operator.
- When in doubt about signal strength, lean toward asking.
- The `AGENTS.md` soft hook is usually sufficient; the Hookify hard hook only when the
  operator wants mechanical enforcement.

## Related

- `codebase-onboarding` — first-pass repo map when the project is unfamiliar
- `coding-standards` — general standards, which legacy rules refine rather than replace
- `grilling` — the one-question-at-a-time interview protocol
- `hookify-rules` — the hard-hook mechanism
- `domain-modeling` — `CONTEXT.md` for domain language, which is separate from style rules
