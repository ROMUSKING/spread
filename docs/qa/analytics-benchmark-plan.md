---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP benchmark plan"
---

# Analytics Benchmark Plan: DuckDB + Derived Data Planes

## Purpose

Benchmark whether DuckDB can safely absorb post-MVP analytical workloads without increasing operational database risk.

## Benchmarks

| ID | Goal | Blocks if |
|---|---|---|
| BENCH-DUCKDB-001 | Query 1M/10M-row governed Parquet projections with tenant/permission filters. | p95 exceeds target or filter bypass occurs. |
| BENCH-DUCKDB-002 | Export PostgreSQL projections to Parquet by outbox watermark. | artifact completeness or schema hash check fails. |
| BENCH-DUCKDB-003 | Compare DuckDB aggregate outputs against PostgreSQL projection aggregates. | exact fields diverge by non-zero tolerance. |
| BENCH-DUCKDB-004 | Analyze TigerBeetle-derived ledger projections. | query uses raw unreconciled ledger data. |
| BENCH-DATA-PLANE-001 | Combined query path: pgvector context + DuckDB aggregate + deterministic source references. | answer uses vector similarity as numeric truth. |

## Required datasets

```text
pilot-v1-small
pilot-v1-10k
analytics-v1-1m
analytics-v1-ledger-projection
analytics-v1-regulated-blocked
```

## Execution rules

- Use approved projection artifacts only.
- Record DuckDB version, PostgreSQL version, machine type, artifact row counts, compression, and row-group size.
- Run exact PostgreSQL parity checks for canonical aggregates.
- Run tenant/permission-bypass tests before performance benchmarks.
- Record edit-path p95 during analytical load.


## Compatibility benchmark aliases

| ID | Alias target |
|---|---|
| BENCH-ANALYTICS-001 | See `docs/qa/duckdb-benchmark-plan.md`. |
| BENCH-ANALYTICS-002 | See `docs/qa/duckdb-benchmark-plan.md`. |
| BENCH-ANALYTICS-003 | See `docs/qa/duckdb-benchmark-plan.md`. |
| BENCH-ANALYTICS-004 | See `docs/qa/duckdb-benchmark-plan.md`. |
| BENCH-ANALYTICS-005 | See `docs/qa/duckdb-benchmark-plan.md`. |
| BENCH-ANALYTICS-006 | See `docs/qa/duckdb-benchmark-plan.md`. |
| BENCH-ANALYTICS-007 | See `docs/qa/duckdb-benchmark-plan.md`. |
