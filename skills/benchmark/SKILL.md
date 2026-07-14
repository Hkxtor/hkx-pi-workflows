---
name: hkx-benchmark
description: Measure performance baselines, before/after PR regressions, and stack comparisons. Use when you need numbers first. Not the optimization loop itself (benchmark-optimization-loop), latency architecture (latency-critical-systems), or ETL throughput redesign (data-throughput-accelerator).
origin: HKX-converted-for-Pi
---

# HKX Benchmark For Pi

Measure performance baselines, detect regressions, and compare alternatives using
Pi-native tools.

## When to Use

- Before and after a PR to measure performance impact
- Setting up performance baselines for a project
- When users report "it feels slow"
- Before a launch — ensure you meet performance targets
- Comparing your stack against alternatives

## Modes

### Mode 1: Page Performance

Measures real browser metrics via Pi browser tool:

```
1. Navigate to each target URL using browser tool
2. Measure Core Web Vitals via page.evaluate():
   - LCP (Largest Contentful Paint) — target < 2.5s
   - CLS (Cumulative Layout Shift) — target < 0.1
   - INP (Interaction to Next Paint) — target < 200ms
   - FCP (First Contentful Paint) — target < 1.8s
   - TTFB (Time to First Byte) — target < 800ms
3. Measure resource sizes via Performance API:
   - Total page weight (target < 1MB)
   - JS bundle size (target < 200KB gzipped)
   - CSS size
   - Image weight
   - Third-party script weight
4. Count network requests via PerformanceObserver
5. Check for render-blocking resources
```

Use `tab.evaluate()` to run Performance API queries in the browser context.

### Mode 2: API Performance

Benchmarks API endpoints using bash + curl or httpie:

```
1. Hit each endpoint 100 times sequentially or with controlled concurrency
2. Measure: p50, p95, p99 latency
3. Track: response size, status codes
4. Test under load: 10 concurrent requests (use xargs -P or similar)
5. Compare against SLA targets
```

Collect timing with `curl -w` or `time` and compute percentiles in script.

### Mode 3: Build Performance

Measures development feedback loop using bash:

```
1. Cold build time — full clean build
2. Hot reload time (HMR) — if applicable
3. Test suite duration — run test command with timing
4. TypeScript check time — `npx tsc --noEmit` or equivalent
5. Lint time — project linter
6. Docker build time — if applicable
```

### Mode 4: Before/After Comparison

Run before and after a change to measure impact:

1. Collect baseline metrics and save to `.pi/benchmarks/baseline.json`
2. Make changes
3. Collect comparison metrics
4. Generate delta report

Output format:

```text
| Metric | Before | After | Delta | Verdict |
|--------|--------|-------|-------|---------|
| LCP | 1.2s | 1.4s | +200ms | WARNING: WARN |
| Bundle | 180KB | 175KB | -5KB | ✓ BETTER |
| Build | 12s | 14s | +2s | WARNING: WARN |
```

## Baseline Storage

Store baselines in `.pi/benchmarks/` as JSON. Git-track so the team shares
baselines.

Schema:

```json
{
  "timestamp": "ISO-8601",
  "commit": "git SHA",
  "metrics": {
    "lcp_ms": 1200,
    "cls": 0.05,
    "inp_ms": 150,
    "bundle_kb": 180,
    "build_s": 12
  }
}
```

## Tools

Use pi-native tools:

- `browser` — page performance measurement via `tab.evaluate()` and
  `tab.screenshot()`
- `bash` — API benchmarking, build timing, percentile computation
- `read`/`write` — baseline storage and comparison
- `ffgrep` — locate performance-related config (webpack, vite, tsconfig)

## Integration

- Pair with `hkx-canary-watch` skill for post-deploy monitoring
- Pair with `hkx-web-performance` rule for Core Web Vitals guidance
- Run before/after comparison on every performance-sensitive PR

## Safety

- Keep benchmarks read-only on production URLs unless user approves load testing
- Do not run API benchmarks against production without explicit approval
- Respect rate limits and robots.txt
