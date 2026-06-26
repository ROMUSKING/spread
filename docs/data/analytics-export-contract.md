---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "canonical analytics export DDL and lineage contract"
---

# Analytics Export Contract

This file owns the canonical PostgreSQL DDL for DuckDB-ready analytics snapshots. Other documents may describe the contract but must not duplicate these `CREATE TABLE` definitions.

## Principles

1. Analytics is derived from permissioned projections, not operational tables directly.
2. Every snapshot records source version, outbox high-watermark, schema hash, data classification, and permission scope.
3. Snapshot and result artifacts are disposable, expirable, and rebuildable.
4. DuckDB may query snapshots; it must not own ERP truth.

## DDL

```sql
CREATE TABLE analytics_dataset_catalog (
  tenant_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  dataset_key TEXT NOT NULL,
  dataset_kind TEXT NOT NULL CHECK (
    dataset_kind IN ('projection', 'ledger_projection', 'semantic_projection', 'report_snapshot')
  ),
  source_projection_name TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  data_classification TEXT NOT NULL CHECK (
    data_classification IN ('public', 'internal', 'confidential', 'regulated', 'blocked')
  ),
  export_allowed BOOLEAN NOT NULL DEFAULT false,
  regulated_export_allowed BOOLEAN NOT NULL DEFAULT false,
  default_retention_days INTEGER NOT NULL DEFAULT 7 CHECK (default_retention_days BETWEEN 1 AND 365),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, dataset_id),
  UNIQUE (tenant_id, dataset_key)
);

CREATE TABLE analytics_snapshot_manifest (
  tenant_id UUID NOT NULL,
  snapshot_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  snapshot_format TEXT NOT NULL CHECK (snapshot_format IN ('parquet', 'duckdb', 'csv_preview')),
  snapshot_uri TEXT NOT NULL,
  source_projection_version BIGINT NOT NULL,
  source_high_watermark_outbox_id BIGINT NOT NULL,
  schema_hash TEXT NOT NULL,
  permission_scope_hash TEXT NOT NULL,
  data_classification TEXT NOT NULL,
  row_count BIGINT NOT NULL CHECK (row_count >= 0),
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  artifact_hash TEXT NOT NULL,
  created_by_job_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, snapshot_id),
  FOREIGN KEY (tenant_id, dataset_id) REFERENCES analytics_dataset_catalog (tenant_id, dataset_id)
);

CREATE TABLE analytics_query_jobs (
  tenant_id UUID NOT NULL,
  query_job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  query_engine TEXT NOT NULL CHECK (query_engine IN ('duckdb', 'postgres_preview')),
  query_mode TEXT NOT NULL CHECK (query_mode IN ('template', 'internal_admin', 'reconciliation')),
  query_template_id TEXT NOT NULL,
  parameter_hash TEXT NOT NULL,
  snapshot_ids UUID[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired')),
  result_uri TEXT NULL,
  result_artifact_hash TEXT NULL,
  row_limit INTEGER NOT NULL DEFAULT 100000 CHECK (row_limit > 0),
  time_budget_ms INTEGER NOT NULL DEFAULT 30000 CHECK (time_budget_ms BETWEEN 1000 AND 600000),
  memory_budget_mb INTEGER NOT NULL DEFAULT 512 CHECK (memory_budget_mb BETWEEN 64 AND 32768),
  data_classification TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, query_job_id)
);

CREATE TABLE analytics_lineage_edges (
  tenant_id UUID NOT NULL,
  lineage_edge_id UUID NOT NULL,
  from_kind TEXT NOT NULL CHECK (from_kind IN ('projection', 'snapshot', 'query_job', 'result')),
  from_id UUID NOT NULL,
  to_kind TEXT NOT NULL CHECK (to_kind IN ('snapshot', 'query_job', 'result')),
  to_id UUID NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('derived_from', 'queried_by', 'produced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, lineage_edge_id)
);
```

## Required indexes

```sql
CREATE INDEX ix_analytics_dataset_exportable
  ON analytics_dataset_catalog (tenant_id, dataset_kind, export_allowed, data_classification)
  WHERE deprecated_at IS NULL;

CREATE INDEX ix_analytics_snapshot_dataset_recent
  ON analytics_snapshot_manifest (tenant_id, dataset_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_analytics_snapshot_high_watermark
  ON analytics_snapshot_manifest (tenant_id, dataset_id, source_high_watermark_outbox_id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX ix_analytics_query_jobs_user_recent
  ON analytics_query_jobs (tenant_id, user_id, created_at DESC);

CREATE INDEX ix_analytics_lineage_to
  ON analytics_lineage_edges (tenant_id, to_kind, to_id);
```

## Export eligibility check

A dataset is DuckDB-exportable only if:

```text
export_allowed = true
AND data_classification != 'blocked'
AND regulated_export_allowed = true when data_classification = 'regulated'
AND source_projection_name is backed by a permissioned projection contract
AND a source_high_watermark_outbox_id can be recorded
```

## Query-job safety

Customer-visible DuckDB jobs must use `query_mode = 'template'`. `internal_admin` jobs require Engineering + SRE approval and must not be exposed to customer SQL input.
