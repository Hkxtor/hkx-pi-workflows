---
name: hkx-benchmark-optimization-loop
description: Bounded measure-optimize loop across variants with a promotion gate. Use when making something faster by repeated measured tests, after a baseline exists. Not one-shot baseline capture (benchmark), p95/freshness architecture (latency-critical-systems), or bulk ETL throughput (data-throughput-accelerator).
origin: ECC-converted-for-Pi
---

# Benchmark Optimization Loop

Use this skill to turn "make it faster" into a bounded optimization loop with
real measurements, correctness gates, and a durable winner.

## Required Baseline

Do not optimize until these exist:

- the operation being optimized;
- the correctness gate that must stay green;
- the metric: wall time, p95 latency, rows/sec, cost/run, memory, or error rate;
- the current baseline;
- the search budget: max variants, max time, max spend, and max blast radius.

If the target is unrealistic, preserve the ambition but bound the loop.

## Loop

1. Measure the current baseline.
2. Identify the bottleneck from evidence, not guesswork.
3. Generate variants that test one hypothesis each.
4. Run variants with the same input shape and environment.
5. Reject variants that fail correctness, safety, or reproducibility.
6. Promote the fastest safe variant.
7. Codify the winner in source, config, script, or runbook.
8. Re-run baseline and winner to confirm the delta.

## Variant Ledger

When writing artifacts, prefer `.pi/benchmarks/` for benchmark notes and
machine-readable ledgers.

Track variants in a table like this:

```text
Variant | Hypothesis | Command | Time | Correct? | Notes
baseline | current path | npm run job | 120s | yes | stable
batch-500 | fewer round trips | npm run job -- --batch 500 | 42s | yes | winner
parallel-8 | more workers | npm run job -- --workers 8 | 31s | no | rate limited
```

## Recursive Search

For repeated or hyperparameter-style search:

- persist every run to a ledger;
- compare against the prior accepted winner, not only the previous run;
- keep a holdout or replay check;
- stop when improvement is within noise, correctness fails, cost exceeds the
  budget, or the search starts changing too many variables at once.

Use "best measured safe variant" unless the search space was truly exhaustive.

## Promotion Gate

A variant cannot become the new default until:

- correctness tests pass;
- the performance delta is repeatable or explained;
- rollback is obvious;
- the change is encoded in source control or a durable runbook;
- the final report includes exact commands and measurements.

## Related Skills

- `hkx-benchmark` for single-path measurement and baseline comparison
- `hkx-parallel-execution-optimizer` for safe concurrency lane planning
- `hkx-latency-critical-systems` when the hot path is realtime or streaming
