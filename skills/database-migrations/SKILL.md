---
name: database-migrations
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

Work in this order — each item can invalidate the ones below it:

1. **Migration safety and rollback shape** — migration order matches application deploy order; new constraints cannot fail on existing data; defaults do not rewrite large tables unexpectedly; index names are stable and non-conflicting; rollback or recovery path is named.
2. **Index coverage for the changed access paths** — trace the read/write call sites before recommending an index. An index nobody queries is a write cost with no read benefit.
3. **Constraints, defaults, nullability, integrity** — the cheap checks that prevent bad rows from ever landing.
4. **Lock duration, batching, transaction boundaries** — see the section above.
5. **Query plans** — flag sequential scans on large tables and N+1 patterns at the call sites, not just in the query text.
6. **Tenant isolation and abuse surface** — RLS enabled on multi-tenant tables, using the `(SELECT auth.uid())` pattern so the function is evaluated once per statement; RLS policy columns indexed; least privilege, no `GRANT ALL` to application roles, public-schema permissions revoked.
7. Tests cover old data, new data, and mixed-version compatibility.
8. Generated ORM files are updated only through the generator.

Read the schema, the migration, and the affected call sites **together** before judging any of it. Read-only inspection is the default; never run mutating SQL unless the task explicitly authorizes it.

## Output

```text
Migration plan:
Safety risks:
Deploy order:
Backfill strategy:
Rollback/recovery:
Verification:
```

For a review of someone else's migration or schema change, report in this shape instead:

```text
Scope reviewed:          <schema / migration / call sites>
Correctness risks:      <ordered by severity, each with file:line or the query>
Index gaps:             <access path → missing or wrong index>
Lock / batching risks:
Tenant isolation:
Smallest safe fix:      <or "no change needed">
Not verified:           <what needs a live database to confirm>
```
