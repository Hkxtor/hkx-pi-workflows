---
name: hkx-content-hash-cache-pattern
description: Cache expensive file-processing results using content hashes instead of paths, so cache hits survive renames and invalidate automatically when the file changes.
origin: ECC-converted-for-Pi
---

# Content-Hash Cache Pattern

Use this skill when a workflow repeatedly processes the same files and the
expensive part is deterministic: text extraction, parsing, OCR, embedding,
image analysis, or structured conversion.

## Core Rule

Use **file content** as the cache identity, not the file path.

- file renamed or moved -> cache hit still works
- file content changed -> cache invalidates automatically
- no separate index is required if entries are stored as `<hash>.json`

## Pattern

1. compute a stable content hash such as SHA-256;
2. keep the expensive processing function pure;
3. wrap the function in a cache-aware service layer;
4. store results under a deterministic cache path such as `.cache/<hash>.json`;
5. treat corrupt cache entries as misses, not fatal errors.

## Design Guidance

- hash in chunks for large files;
- include processing-version metadata when cache format or extraction rules change;
- add `--cache/--no-cache` or equivalent runtime control for CLIs and jobs;
- log cache hits and misses with truncated hashes for debugging;
- never let cache code leak into domain logic if a wrapper layer can own it.

## Good Fit

- PDF / document pipelines
- OCR or image-processing jobs
- LLM preprocessing or embedding pipelines
- import / conversion tools that rerun across the same corpus

## Bad Fit

- data that must always be live or freshness-critical
- jobs whose output depends heavily on external mutable state
- caches that would grow unbounded with no retention plan

## Related Skills

- `hkx-data-throughput-accelerator` for large ingestion and backfill speedups
- `hkx-benchmark-optimization-loop` when you need to prove the cache actually helps
