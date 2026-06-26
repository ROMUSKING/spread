---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP transition plan"
---

# Post-MVP DuckDB Transition Plan

## Goal

Introduce DuckDB as a post-MVP analytics plane without increasing Phase 0 scope or compromising PostgreSQL/TigerBeetle/pgvector boundaries.

## Stage 0: MVP preparation

No DuckDB runtime dependency.

Required preparation:

```text
- stable source_version on analytics-eligible projections;
- source_high_watermark_outbox_id for snapshot consistency;
- data_classification and export_allowed metadata;
- permission_scope_hash on derived projections;
- no analytics-only denormalization in command handlers.
```

## Stage 1: P1-ANALYTICS-001 spike

Prove:

```text
- Parquet snapshot export from PostgreSQL projections;
- DuckDB query over Parquet snapshots;
- no edit hot-path regression;
- tenant/permission filtering;
- resource-budget enforcement;
- result lineage and audit trail;
- comparison of Parquet snapshot mode vs internal PostgreSQL attach mode.
```

## Stage 2: Internal analytics

Enable DuckDB workers only for internal SRE/engineering/product reports and reconciliation investigations.

## Stage 3: Template-based customer analytics beta

Enable allowlisted report templates. Customer SQL remains disabled.

## Stage 4: AI-assisted deterministic analytics

pgvector can retrieve candidate objects; DuckDB can compute deterministic aggregates over snapshots. The AI answer must cite deterministic query results and may not treat similarity score as authorization or truth.

## Stage 5: Optional lakehouse path

If snapshot volume grows, Parquet manifests may become a bridge to object-storage partitioning, Iceberg/Delta-style table governance, or an external warehouse. That requires a new ADR.

## Rollback

DuckDB is derived and disposable. Rollback means:

```text
- stop analytics workers;
- mark running query jobs cancelled;
- expire snapshot artifacts;
- keep PostgreSQL projections and command/outbox systems unchanged.
```
