---
name: hkx-canary-watch
description: "Post-deploy canary checks on a live URL: HTTP health, console/network errors, assets, SSE, and coarse performance regressions. Use after deploy. Not E2E test authoring (e2e-testing) or full visual-regression browser QA suites (browser-qa)."
origin: HKX-converted-for-Pi
---

# HKX Canary Watch For Pi

Use after deploys, merges, dependency upgrades, or release candidate promotion to
verify the deployed surface still behaves.

## Modes

- quick check: one pass
- compare: staging vs production
- watch window: repeated checks during launch

Repeated watch loops should be bounded by duration and interval.

## Checks

- HTTP status for entry pages
- critical API endpoints
- static asset status and content type
- console errors
- failed network requests
- key content presence
- SSE or streaming endpoint connection/heartbeat
- basic performance deltas when baseline exists
- mobile viewport smoke when UI is user-facing

## Safety

- Avoid credentialed actions unless the user supplies a safe test account and
  explicitly asks for it.
- Keep checks read-only.
- Do not post alerts externally unless approved.
- If a browser tool is unavailable, report HTTP-only coverage honestly.

## Report

```text
Canary report:
- target:
- mode:
- status:
- failures:
- warnings:
- evidence:
- next action:
```

## Failure Classification

| Failure | Severity |
| --- | --- |
| entry URL non-2xx/3xx | critical |
| critical API 5xx | critical |
| static JS/CSS 4xx/5xx | critical |
| console error spike | warning/critical by impact |
| SSE no heartbeat | warning/critical by feature |
| content missing | warning/critical by feature |
| performance regression | warning unless SLA broken |
