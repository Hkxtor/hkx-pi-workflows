---
description: Measurement-first performance, model routing, context, and troubleshooting guidance for HKX Pi workflows.
---

# HKX Common Performance

Use this rule when a task affects hot paths, build speed, runtime latency, streaming, large inputs, agent throughput, or tool/model cost.

## Measure Before Optimizing

- Establish the current behavior before changing an optimization target.
- Benchmark the path that users or operators actually experience.
- Keep correctness tests alongside performance checks so faster code cannot silently change behavior.
- Prefer removing work over caching or parallelizing unnecessary work.

## Implementation Defaults

- Avoid avoidable allocations, string construction, copies, serialization, and repeated parsing in hot paths.
- Bound loops, queries, streams, retries, and concurrency.
- Use cancellation and timeouts around external work.
- Keep caches content-addressed or explicitly invalidated when stale data would be dangerous.

## Agent and Model Routing

- Use cheaper or smaller workers for mechanical, independent, low-risk review and collection tasks.
- Use stronger reasoning for architecture, security, cross-file refactors, ambiguous failures, and final risk review.
- Parallelize independent exploration, but keep write ownership clear.
- Do not spawn agents for work a deterministic tool can answer more safely.

## Context Management

- Retrieve only the files and ranges needed for the current decision.
- Summarize durable findings into project memory or docs only when they prevent future rediscovery.
- Split unrelated work into separate packages or phases rather than carrying stale context forward.

## Build and Runtime Troubleshooting

- Read the first real error and the failing command, not only the last line.
- Fix root causes incrementally and re-run the failing check.
- Avoid suppressing warnings or exceptions to make a check green.
- Record what was actually verified and what remains unproven.
