---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP target; MVP preparation guidance"
---

# DuckDB Analytics Plane

## Decision

DuckDB is the preferred **post-MVP analytics plane** for read-heavy analytics, exports, reconciliation reports, and BI-style exploration over permissioned snapshots.

MVP must not depend on DuckDB. MVP should prepare for it by producing stable, versioned, permissioned projections and export manifests.

## Why DuckDB fits this system

DuckDB is an embedded OLAP engine with strong support for Parquet reads/writes, projection pushdown, filter pushdown, and in-process analytical execution. It is well suited for analyzing columnar snapshots and export datasets generated from PostgreSQL projections.

DuckDB is not an OLTP store for this product. Its documented concurrency model supports one read-write process for a DuckDB database file, or multiple read-only processes with no writer. That means DuckDB should run behind analytics workers and snapshot files rather than on the ordinary edit/API hot path.

## Role in the post-MVP architecture

```text
PostgreSQL control plane
  -> permissioned projections
  -> analytics snapshot manifests
  -> Parquet or DuckDB-native snapshot files
  -> DuckDB analytics worker
  -> audited result artifact
```

## Good use cases

| Use case | DuckDB fit | Notes |
|---|---:|---|
| Spreadsheet export with filters/grouping | High | Query snapshot, not hot tables. |
| Large pivot/aggregate over workbook projection | High | Keep result asynchronous. |
| Ledger reconciliation drilldown | High | Use PostgreSQL ledger projections, not raw TigerBeetle direct reads. |
| Import preview/profiling for large CSV/Parquet | High | Keep outside command path until accepted. |
| Internal BI against pilot snapshots | High | Use tenant-scoped snapshots. |
| AI tool deterministic aggregate query | Medium-high | Use DuckDB after pgvector retrieval identifies candidate objects. |
| Direct customer arbitrary SQL | Low initially | Requires separate sandbox ADR. |
| Operational command validation | No | Must remain in domain command handlers. |

## Non-goals

DuckDB must not become:

```text
- operational source of truth;
- a replacement for PostgreSQL permissions/RLS;
- a replacement for TigerBeetle numeric correctness;
- a replacement for pgvector semantic retrieval;
- an edit-path dependency;
- a customer arbitrary-SQL service before sandbox evidence;
- a multi-process write database for production workloads.
```

## Default source strategy

### Selected default: Parquet snapshot mode

```text
PostgreSQL projection -> snapshot manifest -> Parquet files -> DuckDB query worker
```

Reasons:

- isolates PostgreSQL from analytical scans;
- captures source high-watermark and schema hash;
- can be encrypted, retained, expired, and audited;
- prepares a future lakehouse path without committing to one now.

### Allowed internal mode: PostgreSQL attach/scan

DuckDB's PostgreSQL extension can attach PostgreSQL and query tables. This is useful for internal spikes and migration checks, but it is not the default customer-facing analytics path.

It may be used only when:

```text
- the job is internal or explicitly approved;
- the query uses a read-only PostgreSQL role;
- tenant and permission filters are applied by controlled templates;
- query timeout and row limits are enforced;
- the job is excluded from the ordinary edit latency SLO.
```

### Allowed repeated-report mode: DuckDB-native snapshot database

A worker may build a tenant/workbook-scoped DuckDB file from Parquet snapshots for repeated internal reports. This file is still derived and disposable.

## Snapshot consistency rule

Every analytics snapshot must include:

```text
tenant_id
dataset_id
snapshot_id
source_projection_version
source_high_watermark_outbox_id
schema_hash
permission_scope_hash
data_classification
created_at
expires_at
```

If the snapshot cannot prove its high-watermark and schema hash, the worker must fail closed.

## Interaction with TigerBeetle

DuckDB must not query TigerBeetle directly for customer reports. Use this path:

```text
TigerBeetle authoritative transfers
  -> PostgreSQL ledger projection/reconciliation manifest
  -> analytics snapshot
  -> DuckDB query
```

This preserves ERP metadata, permissions, command lineage, and migration state.

## Interaction with pgvector

pgvector can find semantically relevant objects; DuckDB can compute deterministic aggregates over permissioned snapshots for those objects.

Correct pattern:

```text
pgvector retrieval -> candidate object IDs -> permission filter -> DuckDB aggregate -> deterministic answer with cited records
```

Rejected pattern:

```text
vector similarity -> unfiltered analytics query -> generated answer
```

## Interaction with formula workers

Formula workers calculate workbook formula results and dependency deltas. DuckDB may analyze formula result projections after they are materialized. DuckDB must not become the synchronous formula evaluator in the edit path.

## Observability

Required metrics:

```text
analytics_snapshot_export_duration_ms
analytics_snapshot_rows_total
analytics_snapshot_bytes_total
analytics_duckdb_query_duration_ms
analytics_duckdb_memory_peak_mb
analytics_duckdb_result_rows_total
analytics_duckdb_failed_jobs_total
analytics_permission_filter_rejections_total
analytics_snapshot_high_watermark_lag_s
```

## Security and privacy

- One tenant per snapshot artifact unless a separate enterprise analytics ADR approves multi-tenant aggregates.
- Regulated data is excluded by default.
- Snapshot URIs are not exposed directly to clients.
- Result artifacts inherit the highest data classification of their inputs.
- Query jobs record user, role, template, parameter hash, snapshot IDs, and result artifact hash.

## Phase posture

| Phase | DuckDB posture |
|---|---|
| Phase 0 / MVP | No DuckDB dependency. Prepare projection metadata and high-watermarks. |
| P1-ANALYTICS-001 | Spike Parquet snapshot query, PostgreSQL attach safety, and resource limits. |
| Post-MVP internal | Enable internal analytics and reconciliation workers. |
| Post-MVP customer beta | Enable template-based reports only. |
| Later | Consider controlled SQL sandbox and lakehouse integration. |

## Numeric type policy

TigerBeetle identifiers and unsigned 128-bit ledger values must not be represented as approximate floating point in DuckDB exports.

Recommended export mapping:

| Source value | DuckDB/export type | Reason |
|---|---|---|
| `tenant_id`, `object_id`, `command_id`, `movement_group_id` | `UUID` or `VARCHAR` | Human-debuggable and join-stable. |
| TigerBeetle u128 IDs | `VARCHAR` plus optional `UHUGEINT` shadow when safe | DuckDB has `UHUGEINT`, but decimal export tools may not preserve all u128 values consistently. |
| TigerBeetle u64 timestamps | `UBIGINT` plus normalized timestamp column | Preserves exact value and queryable time semantics. |
| Monetary/stock amounts | `DECIMAL(width, scale)` where width <= 18 when possible; otherwise exact text plus scaled integer parts | Avoid accidental floating-point arithmetic. |
| Ratios/KPIs | `DOUBLE` only for non-authoritative analytics | Analytics-only, never source-of-truth ledger arithmetic. |

DuckDB `DOUBLE` must not be used for financial or stock source-of-truth values.

## Operational write prohibition

DuckDB must not write operational PostgreSQL tables. It may create derived analytical result artifacts only through approved export/query jobs.


## Selected strategy phrase

The selected DuckDB strategy is **Parquet artifact lake + controlled read bridge**: use governed Parquet artifacts by default, and allow direct PostgreSQL bridging only for internal benchmarked jobs.

DuckDB must not write operational PostgreSQL tables. The analytics plane does not write operational PostgreSQL tables and never bypasses `permission_scope_hash`.

## Numeric type policy

For TigerBeetle-derived u128/u64 identifiers in DuckDB artifacts, use decimal text or `DECIMAL(38,0)` only when bounds are proven. Where DuckDB supports `UHUGEINT`, it may be evaluated in a spike, but portable Parquet snapshots should preserve the PostgreSQL decimal/text contract.


## Quack/DuckLake note

DuckDB's native in-process model is still treated conservatively in this pack: do not use a shared DuckDB database file as the operational product database. Newer multi-process/server-style options such as Quack, and cataloged lakehouse-style options such as DuckLake, are future strategy candidates only. They require a separate ADR because they change concurrency, catalog, credential, and rollback boundaries.
