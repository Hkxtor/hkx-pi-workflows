---
name: hkx-latency-critical-systems
description: Design and verify latency-sensitive paths (realtime dashboards, market data, streaming agents, queues, caches) with p95/freshness metrics. Use for architecture and hot-path latency. Not generic page/API benchmark capture or ETL bulk throughput.
origin: ECC-converted-for-Pi
---

# Latency Critical Systems

Use this skill when the user cares about realtime behavior, hot paths,
streaming freshness, or execution speed. This is engineering guidance, not
authorization for live trading or destructive production actions.

## Split The Metrics

Do not collapse everything into "fast." Track:

- p50, p95, and p99 latency;
- throughput;
- freshness age;
- queue depth;
- cache hit rate;
- provider/API response time;
- browser render time;
- correctness under load;
- failure and retry behavior.

## Map The Hot Path

Write the path from source event to visible result:

```text
source event -> provider API -> ingest worker -> queue -> cache -> route
-> client stream -> browser render -> user-visible state
```

Measure each segment separately before changing it.

## Optimization Order

1. Remove unnecessary round trips.
2. Cache stable reads with freshness metadata.
3. Batch small calls and writes.
4. Move compute closer to the data or the user.
5. Split hot and cold paths.
6. Apply backpressure before queues grow unbounded.
7. Use streaming only when it materially improves freshness or UX.
8. Add canaries for stale data, degraded providers, and bad cache state.

## Verification

Use live readbacks when a deployed surface exists:

- HTTP timing and response headers;
- provider freshness timestamps;
- queue or job state;
- cache state;
- browser verification for actual UI freshness;
- logs around retries and degraded mode.

If benchmark artifacts are written, store them under `.pi/benchmarks/` or a
documented repo-local ops path.

## Guardrails

- Do not optimize latency by dropping required validation.
- Do not hide stale data behind fast cache hits.
- Do not claim millisecond behavior from client labels without measurement.
- Do not run live orders, destructive migrations, or customer-impacting deploys
  without an explicit approval gate.
- Keep secrets and private payloads out of logs and benchmark artifacts.

## Related Skills

- `hkx-canary-watch` for post-deploy live-path checks
- `hkx-benchmark-optimization-loop` for bounded variant search
- `hkx-browser-qa` for browser-visible freshness validation
