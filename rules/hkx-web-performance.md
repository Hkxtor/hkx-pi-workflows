---
description: Pi-native web performance guidance for Core Web Vitals, budgets, loading, media, fonts, motion, and verification.
---

# HKX Web Performance

Use this rule when editing web UI, routes, assets, styling, animation, or client-side data loading that can affect perceived speed or runtime responsiveness.

## Targets

- Treat Core Web Vitals as product requirements: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Keep first render lean: FCP < 1.5s and avoid long main-thread tasks that push TBT beyond 200ms.
- Respect bundle budgets unless the repo has stricter numbers: landing pages < 150 KB gzipped JS / 30 KB CSS, app pages < 300 KB JS / 50 KB CSS, microsites < 80 KB JS / 15 KB CSS.

## Loading Strategy

- Ship less JavaScript first; remove unused client code before adding lazy loading.
- Defer non-critical scripts and styles. Dynamically import heavy libraries at the interaction or route that needs them.
- Preload only the primary font and true hero asset. Extra preloads compete with critical work.
- Keep third-party scripts async/defer, scoped to the pages that need them, and measured after adding them.

## Images and Fonts

- Give every image or media container explicit dimensions to prevent layout shift.
- Use `loading="eager"` and `fetchpriority="high"` only for the main above-the-fold asset; lazy-load below-the-fold media.
- Serve AVIF/WebP where supported and avoid source files much larger than the rendered size.
- Limit font families and weights. Use `font-display: swap`, subset when practical, and preload only the critical weight/style.

## Runtime and Animation

- Prefer CSS transitions for simple motion.
- Animate compositor-friendly properties: `transform` and `opacity`; avoid layout-triggering animation.
- Use `will-change` narrowly and remove it when the transition ends.
- Avoid scroll-handler churn. Prefer IntersectionObserver, CSS scroll features, or well-bounded `requestAnimationFrame` work.
- Keep React/Vue/Svelte state updates local to the component that needs them; avoid re-rendering full pages for interaction-only state.

## Pi Verification Checklist

- Inspect the affected route or component path before optimizing; do not guess where cost lives.
- Run the narrowest available check that covers the changed route, component, or asset pipeline.
- For UI-visible changes, verify no new layout shift, blocking resource, oversized image, or avoidable client bundle growth was introduced.
- Report exact verification performed and any unmeasured performance claim as unproven.
