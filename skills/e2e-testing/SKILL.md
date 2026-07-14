---
name: hkx-e2e-testing
description: "Author and triage end-to-end tests: Playwright/browser journeys, CLI/install smoke, artifacts, and flakes. Use when writing or fixing E2E coverage. Not ad-hoc post-deploy browser QA (browser-qa) or production canary watches (canary-watch)."
origin: HKX-converted-for-Pi
---

# HKX E2E Testing For Pi

Use for user-visible workflow tests: web apps, dashboards, CLI flows, browser
automation, install methods, release smoke checks, or multi-service flows.

## Choose E2E Only When Needed

Use E2E for:

- critical user journeys
- integration across packages/services
- browser behavior and layout
- install/update flows
- CLI command behavior from a clean environment
- regressions that unit tests cannot observe

Avoid E2E for pure functions, parser details, or behavior already covered by
contract tests.

## Test Design

- Assert user-visible outcomes, not implementation internals.
- Prefer stable locators and explicit states.
- Avoid arbitrary sleeps.
- Keep test data isolated and resettable.
- Capture artifacts only when they aid diagnosis.
- Gate slow or environment-heavy tests behind explicit env vars.

## Browser Pattern

For Playwright-style tests:

- use locators, not raw selectors when possible
- wait for specific UI or network conditions
- test success, empty, error, and permission states
- cover desktop and mobile for critical pages
- record screenshots/traces on failure

```typescript
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByText("Saved")).toBeVisible();
```

## CLI and Install Pattern

For Pi-like CLI packages:

- run the built command, not only internal functions
- test `--help`, `--version`, smoke startup, and one critical command
- isolate HOME/config directories where possible
- verify exit codes and stable output
- keep credentialed paths out of default E2E

## Flake Triage

When a test flakes:

1. Re-run the smallest failing test repeatedly.
2. Check timing assumptions and external dependencies.
3. Replace sleeps with observed states.
4. Quarantine only with an issue or explicit owner.
5. Keep artifacts for the failure mode.

## Output

```text
E2E target:
Critical path:
Environment:
Artifacts:
Failures:
Fix or quarantine decision:
```
