---
name: hkx-database-migrations
description: Safe database migration workflow for schema changes, indexes, backfills, rollbacks, and zero-downtime deploys across SQL and ORM-backed Pi projects.
origin: HKX-converted-for-Pi
---

# HKX Database Migrations For Pi

Use this before creating, editing, reviewing, or deploying schema migrations,
indexes, data backfills, or persistent storage format changes.

## Core Rules

- Every production schema change must be represented as a migration.
- Do not edit a migration that has already run outside local development.
- Separate schema changes from large data backfills.
- Prefer forward fixes over destructive rollbacks in production.
- Test against realistic row counts when lock time matters.
- Document rollback or recovery for high-impact changes.

## Preflight

Identify:

- database engine and version
- migration tool or ORM
- table size and write traffic
- deploy order
- application code reading/writing old and new shapes
- backup/restore or forward-fix path

Inspect local evidence first:

```bash
rg --files | rg 'migrations|schema|prisma|drizzle|kysely|typeorm|django|sql'
rg -n 'migrate|migration|schema|CREATE TABLE|ALTER TABLE|CREATE INDEX'
```

## Expand-Contract Pattern

Use for renames, type changes, and required fields:

1. Expand: add nullable/new column or table.
2. Dual write or compatibility read.
3. Backfill in bounded batches.
4. Validate parity.
5. Switch reads to new shape.
6. Contract: stop writing old shape, then remove later.

## Lock and Backfill Safety

- Avoid full table rewrites on large tables.
- Create indexes concurrently when the database supports it.
- Batch updates; avoid one huge transaction for large data changes.
- Make backfills resumable and idempotent.
- Add observability for progress and failures.
- Never combine a risky DDL lock with an unrelated feature deploy.

## Review Checklist

- Migration order matches application deploy order.
- New constraints cannot fail on existing data.
- Defaults do not rewrite large tables unexpectedly.
- Index names are stable and non-conflicting.
- Rollback or recovery path is named.
- Tests cover old data, new data, and mixed-version compatibility.
- Generated ORM files are updated only through the generator.

## Output

```text
Migration plan:
Safety risks:
Deploy order:
Backfill strategy:
Rollback/recovery:
Verification:
```
