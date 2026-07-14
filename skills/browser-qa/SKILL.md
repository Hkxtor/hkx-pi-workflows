---
name: hkx-browser-qa
description: "Post-deploy browser automation QA with the Pi browser tool: smoke, interaction, visual regression, and honest a11y scope—read-only by default. Use after features are deployed or locally runnable in a browser. Not unit/e2e test authoring (e2e-testing), design direction, or pure WCAG checklist work without a live page (accessibility)."
origin: HKX-converted-for-Pi
---

# Browser QA — Automated Visual Testing & Interaction

## When to Use

- After deploying a feature to staging/preview
- When you need to verify UI behavior across pages
- Before shipping — confirm layouts, forms, interactions actually work
- When reviewing PRs that touch frontend code
- Accessibility audits and responsive testing

## How It Works

Use the Pi `browser` tool to interact with live pages like a real user: `open` a tab, then `run` JavaScript via `tab.evaluate`, `tab.observe` for accessibility snapshots, `tab.screenshot` for visual capture, `tab.extract` for readable content, `tab.waitForResponse` / `tab.waitForUrl` for navigation/network signals.

### Safety first — blast radius (run read-only by default)

Browser QA drives real auth and real user journeys, so treat the blast radius explicitly.
Default to **read-only**: never run a **mutating** journey (checkout, payment, delete,
mass-update) against a production URL — require an explicit opt-in **and** a staging/preview
URL. Use seeded **test credentials**, never real production logins, and **redact**
credentials/tokens/PII before saving any screenshot.

### Phase 1: Smoke Test
```
1. browser open <URL> -> reusable named tab
2. tab.observe() -> check console errors (filter noise: analytics, third-party) via tab.evaluate
3. tab.waitForResponse(/4xx|5xx/) or check network for failures
4. tab.screenshot({viewport: desktop}) and tab.screenshot({viewport: mobile}) above-the-fold
5. Check Core Web Vitals via tab.evaluate(performance API): LCP < 2.5s, CLS < 0.1, INP < 200ms
   (INP replaced FID in March 2024; thresholds per web.dev)
```

### Phase 2: Interaction Test
```
1. tab.observe() -> collect nav link ids; click each via tab.ref(id).click() — verify no dead links
   (Navigation invalidates element ids — re-observe before each click)
2. tab.fill(selector, valid) -> submit -> verify success state
3. tab.fill(selector, invalid) -> submit -> verify error state
4. Test auth flow: login -> protected page -> logout (test creds only, never prod)
5. Test critical user journeys (checkout, onboarding, search)
   — read-only by default; only exercise mutating journeys against staging
     with explicit opt-in (see "Safety first" above)
```

### Phase 3: Visual Regression
```
1. tab.screenshot key pages at 3 breakpoints (375px, 768px, 1440px)
2. Compare against committed baseline screenshots
   — no baseline => report INCONCLUSIVE, never a silent PASS
3. Flag layout shifts > 5px, missing elements, overflow
4. Check dark mode if applicable
```

### Phase 4: Accessibility
```
1. Run axe-core via tab.evaluate(inject + axe.run) on each page, or fall back to
   tab.ariaSnapshot() for a manual ARIA-tree review
2. Flag WCAG 2.2 AA violations (contrast, labels, focus order)
3. Verify keyboard navigation works end-to-end (tab.press / tab.fill / keyboard sequence)
4. Check screen reader landmarks via tab.ariaSnapshot() roles and names
```

> Note: axe-core automatically covers roughly 30–40% of WCAG. A clean run is **necessary,
> not sufficient** — keyboard nav, focus order, and a screen-reader pass still need a manual
> check via `tab.ariaSnapshot()`. Don't report "accessible" from an automated pass alone.

## Output Format

```markdown
## QA Report — [URL] — [timestamp]

### Smoke Test
- Console errors: 0 critical, 2 warnings (analytics noise)
- Network: all 200/304, no failures
- Core Web Vitals: LCP 1.2s OK, CLS 0.02 OK, INP 89ms OK

### Interactions
- [OK] Nav links: 12/12 working
- [FAIL] Contact form: missing error state for invalid email
- [OK] Auth flow: login/logout working

### Visual
- [FAIL] Hero section overflows on 375px viewport
- [OK] Dark mode: all pages consistent

### Accessibility
- 2 AA violations: missing alt text on hero image, low contrast on footer links

### Verdict: SHIP WITH FIXES (2 issues, 0 blockers)
# verdict in {SHIP, SHIP WITH FIXES, DO NOT SHIP}; use INCONCLUSIVE if no visual baseline
```

## Integration

- Default: the Pi `browser` tool (Chromium with stealth patches).
- Screenshots taken with `tab.screenshot({ save: <path> })` persist across run calls for
  baseline comparison; review committed baselines into the repo under `qa/baselines/`.
- Pair with `hkx-canary-watch` for post-deploy monitoring.
- Pair with `hkx-accessibility` for the deeper WCAG audit pass when automated checks surface issues.
