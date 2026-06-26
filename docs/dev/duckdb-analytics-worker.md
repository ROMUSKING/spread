---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP developer guidance"
---

# DuckDB Analytics Worker

## Purpose

The DuckDB analytics worker runs read-heavy analytical jobs over permissioned snapshots. It is isolated from API/edit workers so analytics cannot degrade command latency.

## Worker modes

| Mode | Status | Use |
|---|---|---|
| `parquet_snapshot` | Default post-MVP | Query tenant/workbook snapshots with DuckDB. |
| `duckdb_snapshot_file` | Optional | Repeated reports over a derived DuckDB file. |
| `postgres_attach_internal` | Spike/admin only | Controlled internal comparison against PostgreSQL. |
| `customer_sql` | Not allowed before separate ADR | Requires sandbox, quotas, allowlist, and security review. |

## Execution contract

```text
1. Load analytics_query_jobs row.
2. Verify user, tenant, role, query template, and snapshot permissions.
3. Verify all snapshot manifests are current enough for the query template.
4. Open DuckDB in an isolated worker process/container.
5. Apply memory, timeout, row-limit, and output-size budgets.
6. Query Parquet/DuckDB snapshots.
7. Write result artifact and result hash.
8. Mark query job terminal and emit audit/outbox event.
```

## Prohibited behavior

```text
- no DuckDB execution inside ordinary API request handlers;
- no writes to operational PostgreSQL tables from DuckDB;
- no customer-supplied SQL before a sandbox ADR;
- no unbounded `postgres_attach` scans against production PostgreSQL;
- no bypass of tenant, role, workbook, or object visibility filters;
- no use of analytics results as source-of-truth mutation facts.
```

## Safe query templates

Query templates must declare:

```yaml
template_id: stock-aging-summary-v1
allowed_datasets: [stock_balance_projection, stock_movement_projection]
required_filters: [tenant_id, workbook_id, permission_scope_hash]
max_rows: 100000
max_runtime_ms: 30000
max_memory_mb: 1024
output_classification: confidential
```

## DuckDB/PostgreSQL attach rule

Direct PostgreSQL attach is limited to `postgres_attach_internal` jobs. The worker must use a read-only PostgreSQL role and SRE-approved connection pool limits. If p95 edit latency regresses by more than the SLO threshold during a direct-attach benchmark, direct attach remains disabled.

## Resource limits

Required controls:

```text
statement timeout
process/container memory limit
output row limit
output byte limit
per-tenant concurrent job limit
query-template allowlist
cancellation path
audit record for every job
```

## Result handoff

Analytics results may be shown to users as reports or suggestions. If a user accepts a suggested action, the system must submit a normal command through the command layer.
