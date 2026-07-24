---
name: hkx-santa-method
description: "Multi-agent adversarial verification with convergence loop. Two independent reviewers must both PASS before output ships. Use for high-stakes code, docs, or claims. Not deterministic lint/test (verification-loop) or multi-option decisions (council)."
version: 1.0.0
origin: ECC-converted-for-Pi
---

# Santa Method (Pi)

Make a list. Check it twice. If it's naughty, fix it until it's nice.

A single agent reviewing its own output shares the same blind spots that produced the output. Two **independent** reviewers with **no shared review context** break that failure mode.

Operator entry: `/hkx-santa-loop`.

## When to Activate

- Output will be published, deployed, or consumed by end users
- Code ships without a separate human review
- Content accuracy matters (docs, claims, API references)
- Compliance, security, or brand constraints must be enforced
- Hallucination risk is elevated

### Do Not Use When

| Instead | Use |
| --- | --- |
| Deterministic build/lint/type/test | `verification-loop` |
| Ambiguous product/architecture tradeoff | `council` |
| Internal drafts / exploratory work | just continue |
| Single-pass PR review is enough | `hkx-code-review` / `hkx-adversarial-review` chain |

## Architecture

```text
Generator (or current diff)
        │
        ▼
 Dual independent review (fresh context each)
   Reviewer A ──┐
   Reviewer B ──┴─► both PASS? ──yes──► NICE (ship-ready)
                      │ no
                      ▼
                 Fix only flagged issues
                      │
                 re-review (fresh agents)
                      │
                 max 3 rounds → escalate
```

## Phase Contract

### 1. Scope

Identify what is under review:

- explicit paths / description from the user, or
- current local diff (`git diff --name-only HEAD` + unstaged)

Read the actual files. Do not review from memory alone.

### 2. Rubric

Every criterion needs an objective PASS/FAIL condition. Minimum code rubric:

| Criterion | Pass condition |
| --- | --- |
| Correctness | Logic sound; edge cases handled |
| Security | No secrets, injection, XSS, trust-boundary mistakes |
| Error handling | Failures explicit; no silent success-by-default |
| Completeness | Stated requirements addressed |
| Internal consistency | No contradictions across files |
| No regressions | Existing behavior not broken without intent |

Add domain criteria when relevant (types, migrations, concurrency, a11y).

### 3. Dual independent review

Launch **two** reviewers in parallel with:

- **fresh** context (no parent transcript anchoring)
- **identical** rubric + same inputs
- **structured** JSON only (no free-form essay as the deliverable)

Preferred Pi shape:

```ts
subagent({
  tasks: [
    {
      agent: "hkx.code-reviewer",
      task: REVIEWER_PROMPT,
      context: "fresh",
      output: "santa/review-a.json",
    },
    {
      agent: "hkx.security-reviewer",
      task: REVIEWER_PROMPT,
      context: "fresh",
      output: "santa/review-b.json",
    },
  ],
  concurrency: 2,
})
```

If only one reviewer agent is available, still run **two fresh instances** with the same rubric. Prefer different specializations (code + security, or general + language) when the change spans those risks.

Optional model diversity: if another CLI/model is available and the user asked for multi-model review, use it for Reviewer B **read-only**. Never give external reviewers write access.

#### Reviewer prompt skeleton

```text
You are an independent quality reviewer. You have NOT seen any other review.

## Task / intent
{task_spec}

## Output under review
{files_or_content}

## Rubric
{rubric}

Evaluate EACH criterion as PASS or FAIL with concrete evidence (path:line when possible).
Your job is to find problems, not to approve.

Return JSON only:
{
  "verdict": "PASS" | "FAIL",
  "checks": [{"criterion":"...","result":"PASS|FAIL","detail":"..."}],
  "critical_issues": ["..."],
  "suggestions": ["..."]
}
```

### 4. Verdict gate

| Reviews | Result |
| --- | --- |
| Both PASS | **NICE** |
| Either FAIL | **NAUGHTY** |

Merge and dedupe `critical_issues` from both reviewers. Suggestions are optional.

### 5. Fix until nice

On NAUGHTY:

1. Fix **only** critical issues (no drive-by refactors)
2. Re-run **fresh** reviewers (no memory of prior rounds)
3. Cap at **3** iterations, then escalate to the user with remaining issues

Do **not** auto-push, merge, or deploy. NICE means ship-ready evidence; external mutation stays approval-gated.

## Output Report

```text
SANTA VERDICT: NICE | NAUGHTY (escalated)

Reviewer A: PASS|FAIL
Reviewer B: PASS|FAIL

Both flagged:
A only:
B only:

Iterations: N/3
Result: ship-ready | needs user decision
```

## Failure Modes

| Mode | Mitigation |
| --- | --- |
| Infinite loop | Max 3 rounds, then escalate |
| Rubber stamping | Adversarial prompt + objective rubric |
| Style nitpicking | Rubric forbids subjective-only fails |
| Fix regressions | Fresh reviewers each round |
| Cost blow-up | Bound scope; run verification-loop first |

## Integration

| Skill / surface | Relationship |
| --- | --- |
| `verification-loop` | Run first for deterministic checks |
| `hkx-adversarial-review` chain | Multi-angle one-shot review; Santa adds dual-pass convergence |
| `council` | Decisions under ambiguity, not correctness verification |
| `instinct-evolve` | Repeated Santa misses can become pending instincts via `/hkx-learn-eval` |
| Delegation Completion Contract | Parent owns collection of both reviewers before verdict |

## Notes

- Origin: ECC `santa-method`, rewritten for pi-subagents
- Prefer evidence-backed fails with path:line
- Zero findings is valid when both reviewers PASS with empty critical lists
