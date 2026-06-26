---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP benchmark plan"
---

# DuckDB Benchmark Plan

## Required benchmarks

| ID | Purpose | Blocking condition |
|---|---|---|
| BENCH-ANALYTICS-001 | Export PostgreSQL projection to Parquet snapshot. | Missing lineage/high-watermark or p95 exceeds target by >25%. |
| BENCH-ANALYTICS-002 | DuckDB query over Parquet snapshot at 10k/1m/10m rows. | p95/p99 exceeds SLO or memory cap is breached. |
| BENCH-ANALYTICS-003 | Direct PostgreSQL attach internal-mode safety. | Any edit-path p95 regression above threshold disables direct attach. |
| BENCH-ANALYTICS-004 | Tenant/permission filtered analytics query. | Any cross-tenant or unauthorized row appears. |
| BENCH-ANALYTICS-005 | Snapshot high-watermark consistency. | Snapshot cannot prove source version and outbox watermark. |
| BENCH-ANALYTICS-006 | Worker resource limits. | Query exceeds time/memory/output budgets without cancellation. |
| BENCH-ANALYTICS-007 | Multi-plane analytics: ledger projection + semantic candidates + DuckDB aggregate. | AI-visible answer cannot cite deterministic query output. |

## Dataset sizes

```text
analytics-v1-small: 10k rows
analytics-v1-medium: 1m rows
analytics-v1-large: 10m rows, synthetic only before Compliance approval
```

## Required measurements

```text
export_duration_ms
export_rows_per_s
snapshot_bytes
duckdb_query_duration_ms
duckdb_peak_memory_mb
result_rows
permission_filter_selectivity
edit_path_p95_delta_ms during postgres_attach_internal benchmark
```

## Execution rules

Direct PostgreSQL attach is measured only against an isolated environment with edit-load replay running. If edit p95 regresses beyond `analytics_pg_attach_edit_p95_delta_ms`, direct attach remains disabled outside internal admin jobs.
