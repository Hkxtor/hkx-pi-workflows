---
description: Testing defaults for HKX Pi workflows.
---

# HKX Common Testing

Read this rule when adding tests or changing behavior.

- Test externally observable contracts.
- Prefer focused tests over broad snapshots.
- Avoid placeholder assertions.
- Keep tests deterministic and full-suite safe.
- Restore mocks and environment changes in cleanup.
- Run targeted validation first, then broaden when shared behavior changed.
- Do not add low-value tests for trivial static changes unless they guard a known regression.
