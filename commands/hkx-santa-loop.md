---
name: hkx-santa-loop
description: "Adversarial dual-review convergence loop. Two independent fresh-context reviewers must both PASS before work is ship-ready. Fix and re-review up to 3 rounds. No auto-push."
argument-hint: "[path|glob|description]"
---

# /hkx-santa-loop — Dual independent review until NICE

Scope: `$ARGUMENTS`

Follow the `santa-method` skill end-to-end. This command is the operator entry point.

## Goal

Two independent reviewers, same rubric, **fresh context**, no shared review memory. Both must PASS (**NICE**) or the loop fixes critical issues and re-reviews (max 3 rounds).

## Workflow

### 1. Identify scope

If `$ARGUMENTS` is empty, use the current local change set:

```bash
git status --short
git diff --name-only HEAD
```

Otherwise use the given path, glob, or description. Read the actual files under review.

### 2. Run deterministic checks first (when code)

If the scope is code, run the narrow relevant verification from `verification-loop` (or the repo's usual lint/type/test for touched surfaces). Do not skip into Santa to hide broken builds.

### 3. Build rubric

Objective PASS/FAIL criteria only. Start from the skill's minimum code rubric; extend for the file types in scope.

### 4. Dual independent review

Launch **two** reviewers in **one** parallel batch:

- Prefer `hkx.code-reviewer` + `hkx.security-reviewer` (or language reviewer when clearly better)
- `context: "fresh"` for both
- identical rubric + identical inputs
- require structured JSON verdicts (see skill)

Own collection: wait for **both** results before the verdict gate (Delegation Completion Contract).

### 5. Verdict gate

- Both PASS → **NICE**
- Either FAIL → **NAUGHTY** → merge/dedupe critical issues → fix only those → fresh re-review
- After 3 NAUGHTY rounds → stop and escalate remaining issues to the user

### 6. Ship gate

On NICE:

- Report ship-ready evidence
- **Do not** `git push`, merge, deploy, or publish unless the user explicitly asks in this turn
- Suggest next operator step (`/hkx-review-pr`, commit, or push) without executing gated actions

## Report template

```text
SANTA VERDICT: NICE | NAUGHTY (escalated)

Reviewer A (<agent>): PASS|FAIL
Reviewer B (<agent>): PASS|FAIL

Both flagged:
- ...
A only:
- ...
B only:
- ...

Iterations: N/3
Result: ship-ready | needs user decision
```

## Related

- skill: `santa-method`
- chain: `hkx-adversarial-review` (multi-angle one-shot; no convergence loop)
- `/hkx-code-review`, `/hkx-orch-review`
