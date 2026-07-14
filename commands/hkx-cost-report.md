---
name: hkx-cost-report
description: Generate a local cost report from Pi cost-tracking data.
argument-hint: "[csv]"
---

# /hkx-cost-report - Pi Cost Report

Generate a local cost report from Pi cost-tracking data, summarizing spend by day, model, and session.

## Where the Data Lives

Pi cost tracking data is stored locally. The exact path depends on the Pi setup — check your Pi configuration for the metrics log location (commonly under `~/.pi/` or a configured metrics directory).

Each row is a cumulative snapshot per session. The report takes the latest row per session and sums across sessions (summing every row would multiply-count).

Row schema:

```
{ timestamp, session_id, model, input_tokens, output_tokens, estimated_cost_usd }
```

## What This Command Does

1. Check that the Pi cost metrics file exists. If it does not, tell the user the tracker is not set up yet.
2. Reduce rows to the latest snapshot per session and aggregate.
3. Present a compact report, or export recent rows as CSV when the argument is `csv`.

## Usage

```bash
/hkx-cost-report         # Show summary report
/hkx-cost-report csv     # Export last 100 rows as CSV
```

## Report Process

1. Locate the cost metrics file (check Pi config or common locations).
2. If missing, report that the tracker is not configured.
3. Read and parse JSON lines from the file.
4. For each session, keep only the latest snapshot by timestamp.
5. Aggregate by total, by model, and by day (last 7 days).
6. Display the report.

## Report Format

```
=== Cost summary ===
today:     $0.0000
yesterday: $0.0000
total:     $0.0000  (N sessions)

=== By model ===
   $0.0000  model-name

=== Last 7 days ===
YYYY-MM-DD  $0.0000
```

## CSV Output Format

When `csv` argument is given, output the last 100 rows in CSV format with columns:

```
timestamp,session_id,model,input_tokens,output_tokens,estimated_cost_usd
```

Rely on the precomputed `estimated_cost_usd` values written by the tracker; do not re-estimate pricing from raw tokens.

---

*Part of HKX Pi Workflows*