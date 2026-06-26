---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP evidence gate"
---

# P1-ANALYTICS-001: DuckDB Analytical Plane Evidence Gate

**Owner:** Data Platform Owner + SRE Owner  
**Approver:** Engineering Lead + Security Owner + Compliance Owner  
**Waiver:** Not allowed for regulated data exports

## Scope

Prove DuckDB can serve derived analytical workloads without affecting the operational edit path or bypassing tenant/security boundaries.

## Requirements

1. DuckDB reads only approved projection artifacts or read-only replicas.
2. Operational PostgreSQL primary is not queried by DuckDB in product paths.
3. DuckDB does not write operational PostgreSQL tables.
4. Each artifact includes source watermark, schema hash, projection version, data classification, and permission scope.
5. Query output includes freshness metadata.
6. Regulated or blocked artifacts are inaccessible without compliance sign-off.
7. Exact aggregate checks match PostgreSQL projection aggregates for pilot datasets.
8. TigerBeetle-derived numeric facts are analyzed only through reconciled projections.
9. Long DuckDB queries do not affect edit p95 or outbox polling lag.
10. Support/local DuckDB bundles are time-limited, auditable, and redacted.

## Evidence

```text
ci://tests/analytics/duckdb-artifact-watermark-completeness
ci://tests/analytics/duckdb-no-operational-writeback
ci://tests/analytics/duckdb-permission-filtered-artifacts
ci://tests/analytics/duckdb-blocked-regulated-artifact-rejected
ci://tests/analytics/duckdb-vs-postgres-projection-aggregate-parity
ci://tests/analytics/duckdb-ledger-derived-projection-only
ci://benchmarks/BENCH-DUCKDB-001
ci://benchmarks/BENCH-DUCKDB-002
ci://benchmarks/BENCH-DATA-PLANE-001
```

## SLO reference

`docs/slo-baseline.yml#benchmarks.BENCH-DUCKDB-001`

## Exit decision

```text
A. Adopt DuckDB artifact plane for selected post-MVP analytics.
B. Allow DuckDB only for internal/support analysis.
C. Defer DuckDB and keep analytics in PostgreSQL projections.
D. Escalate to external warehouse/lakehouse evaluation.
```
