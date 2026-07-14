---
description: Pi-native research, plan, TDD, review, verify, and handoff workflow for HKX tasks.
---

# HKX Common Development Workflow

Use this rule for non-trivial feature, bug fix, refactor, prompt, command, skill, rule, or extension work.

## Workflow

1. **Research and reuse**
   - Start with local evidence: existing files, tests, commands, rules, skills, configs, and project guidance.
   - Use current library documentation when the task depends on external APIs or version-specific behavior.
   - Prefer existing project patterns, helpers, and battle-tested dependencies over net-new abstractions.

2. **Plan**
   - Restate the requirement, affected files, order of work, validation commands, and risks.
   - For broad work, decompose and use Pi-native agents for independent read-only discovery or review.
   - Ask only when the missing choice materially changes the outcome.

3. **Test first where behavior changes**
   - Add or update tests that fail for the old behavior and pass for the intended behavior.
   - Cover edge values, error paths, invariant preservation, and integration boundaries.
   - Avoid placeholder assertions and tests that only freeze implementation plumbing.

4. **Implement narrowly**
   - Keep the main session as the writer unless work is explicitly partitioned.
   - Preserve existing architecture; do not create parallel conventions.
   - Remove obsolete code instead of leaving aliases, comments, or dead paths.

5. **Verify**
   - Run the focused validation that covers the changed behavior.
   - Broaden to lint/type/build/security checks when shared contracts or release surfaces changed.
   - Do not claim unrun checks passed.

6. **Review and handoff**
   - Review from the user's perspective: behavior, docs, tests, security, and operational impact.
   - Report changed surfaces, validation observed, and residual risk.

## Defaults

- Use structured Pi tools over shell equivalents.
- Treat external mutation, publishing, deploying, merging, and destructive operations as approval-gated.
- Keep generated workflow artifacts free of private host state and credentials.
