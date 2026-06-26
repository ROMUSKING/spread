---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "canonical post-MVP semantic retrieval data contract"
owner: "Data Platform Owner"
---

# Semantic Retrieval Contract for pgvector

## Purpose

This document owns the canonical PostgreSQL schema contract for post-MVP semantic retrieval.

It is intentionally separate from operational ERP tables. Embeddings are derived, rebuildable projections. Core business tables must not contain vector columns.

## Extension boundary

```sql
-- Post-MVP only. Not part of Phase 0 or MVP.
CREATE EXTENSION IF NOT EXISTS vector;
```

## Tables

```sql
CREATE TABLE ai_source_registry (
  tenant_id UUID NOT NULL,
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'workbook_row',
    'workbook_view',
    'domain_event_summary',
    'audit_explanation',
    'comment',
    'attachment_text',
    'policy_doc',
    'runbook',
    'support_bundle',
    'analytics_artifact_summary'
  )),
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  workbook_id UUID NULL,
  projection_name TEXT NOT NULL,
  projection_version BIGINT NOT NULL,
  source_version BIGINT NOT NULL,
  source_high_watermark_outbox_id BIGINT NULL,
  permission_scope_hash TEXT NOT NULL,
  data_classification TEXT NOT NULL CHECK (data_classification IN (
    'public', 'internal', 'confidential', 'regulated', 'blocked'
  )),
  redaction_policy_version TEXT NOT NULL,
  embedding_allowed BOOLEAN NOT NULL DEFAULT false,
  embedding_block_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, source_id),
  UNIQUE (tenant_id, source_type, object_type, object_id, projection_name)
);

CREATE TABLE ai_chunk_registry (
  tenant_id UUID NOT NULL,
  chunk_id UUID NOT NULL,
  source_id UUID NOT NULL,
  chunk_kind TEXT NOT NULL CHECK (chunk_kind IN (
    'row_summary',
    'field_summary',
    'document_chunk',
    'event_summary',
    'policy_chunk',
    'runbook_chunk',
    'analytics_summary',
    'support_chunk'
  )),
  chunk_text TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'en',
  textsearch TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', chunk_text)) STORED,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  workbook_id UUID NULL,
  projection_version BIGINT NOT NULL,
  source_version BIGINT NOT NULL,
  permission_scope_hash TEXT NOT NULL,
  data_classification TEXT NOT NULL,
  redaction_policy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, chunk_id),
  FOREIGN KEY (tenant_id, source_id)
    REFERENCES ai_source_registry (tenant_id, source_id)
);

CREATE TABLE ai_embedding_model_registry (
  embedding_model_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  dimensions INTEGER NOT NULL CHECK (dimensions > 0),
  embedding_type TEXT NOT NULL CHECK (embedding_type IN ('vector', 'halfvec', 'bit', 'sparsevec')),
  distance_metric TEXT NOT NULL CHECK (distance_metric IN ('cosine', 'l2', 'inner_product', 'l1', 'hamming', 'jaccard')),
  approved_for_data_classes TEXT[] NOT NULL,
  model_card_uri TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ NULL
);

CREATE TABLE ai_embedding_table_registry (
  embedding_table_name TEXT PRIMARY KEY,
  embedding_model_id TEXT NOT NULL REFERENCES ai_embedding_model_registry (embedding_model_id),
  dimensions INTEGER NOT NULL CHECK (dimensions > 0),
  embedding_type TEXT NOT NULL,
  distance_metric TEXT NOT NULL,
  ann_index_kind TEXT NOT NULL CHECK (ann_index_kind IN ('none', 'hnsw', 'ivfflat')),
  ann_index_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Example model-specific embedding table. Real deployments create one table per
-- approved model/dimension/type combination to keep indexes predictable.
CREATE TABLE ai_embeddings_text_1536 (
  tenant_id UUID NOT NULL,
  chunk_id UUID NOT NULL,
  embedding_model_id TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  chunk_hash TEXT NOT NULL,
  source_version BIGINT NOT NULL,
  permission_scope_hash TEXT NOT NULL,
  data_classification TEXT NOT NULL,
  embedding_status TEXT NOT NULL CHECK (embedding_status IN ('ready', 'stale', 'blocked', 'failed')),
  embedded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, chunk_id, embedding_model_id),
  FOREIGN KEY (tenant_id, chunk_id)
    REFERENCES ai_chunk_registry (tenant_id, chunk_id),
  FOREIGN KEY (embedding_model_id)
    REFERENCES ai_embedding_model_registry (embedding_model_id)
);

CREATE TABLE ai_embedding_jobs (
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL,
  source_id UUID NULL,
  chunk_id UUID NULL,
  embedding_model_id TEXT NOT NULL,
  job_kind TEXT NOT NULL CHECK (job_kind IN ('embed_source', 'embed_chunk', 'invalidate_source', 'rebuild_model', 'delete_source')),
  job_status TEXT NOT NULL CHECK (job_status IN ('queued', 'running', 'succeeded', 'failed', 'blocked')),
  source_high_watermark_outbox_id BIGINT NULL,
  failure_code TEXT NULL,
  failure_detail TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, job_id)
);

CREATE TABLE ai_retrieval_audit (
  tenant_id UUID NOT NULL,
  retrieval_id UUID NOT NULL,
  user_id UUID NOT NULL,
  workbook_id UUID NULL,
  query_hash TEXT NOT NULL,
  retrieval_mode TEXT NOT NULL CHECK (retrieval_mode IN ('lexical', 'vector_exact', 'vector_ann', 'hybrid')),
  embedding_model_id TEXT NULL,
  permission_scope_hashes TEXT[] NOT NULL,
  data_classification_max TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  source_high_watermark_outbox_id BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, retrieval_id)
);
```

## Indexes

```sql
CREATE INDEX ix_ai_sources_object_version
  ON ai_source_registry (tenant_id, object_type, object_id, projection_name, source_version)
  WHERE invalidated_at IS NULL;

CREATE INDEX ix_ai_sources_embedding_allowed
  ON ai_source_registry (tenant_id, embedding_allowed, data_classification, permission_scope_hash)
  WHERE invalidated_at IS NULL;

CREATE INDEX ix_ai_chunks_permission_active
  ON ai_chunk_registry (tenant_id, permission_scope_hash, data_classification, object_type, object_id)
  WHERE invalidated_at IS NULL;

CREATE INDEX ix_ai_chunks_textsearch
  ON ai_chunk_registry USING gin (textsearch)
  WHERE invalidated_at IS NULL;

CREATE INDEX ix_ai_embeddings_text_1536_ready
  ON ai_embeddings_text_1536 (tenant_id, embedding_model_id, permission_scope_hash, data_classification)
  WHERE embedding_status = 'ready' AND invalidated_at IS NULL;

-- ANN index is evidence-gated. Exact search remains the baseline.
CREATE INDEX ai_embeddings_text_1536_hnsw_cosine
  ON ai_embeddings_text_1536 USING hnsw (embedding vector_cosine_ops)
  WHERE embedding_status = 'ready' AND invalidated_at IS NULL;
```

## Retrieval patterns

### RetrievalRevalidator contract

Every user-visible retrieval result must pass through `docs/dev/retrieval-revalidator.md`. Vector similarity, lexical match, or DuckDB-derived summaries may produce candidates only. Candidates become visible results only after deterministic revalidation of tenant, permission, data classification, source version, redaction policy, and deterministic authority for numeric facts.

The retrieval API contract is `docs/api/retrieval-revalidator.openapi.yml`.


### Permissioned exact vector retrieval

```sql
SELECT
  c.chunk_id,
  c.object_type,
  c.object_id,
  c.chunk_text,
  e.embedding <=> $1 AS distance
FROM ai_embeddings_text_1536 e
JOIN ai_chunk_registry c
  ON c.tenant_id = e.tenant_id
 AND c.chunk_id = e.chunk_id
WHERE e.tenant_id = $2
  AND e.embedding_model_id = $3
  AND e.embedding_status = 'ready'
  AND e.invalidated_at IS NULL
  AND c.invalidated_at IS NULL
  AND c.permission_scope_hash = ANY($4)
  AND c.data_classification <> 'blocked'
ORDER BY e.embedding <=> $1
LIMIT $5;
```

### Hybrid retrieval contract

User-facing retrieval must combine semantic and deterministic retrieval when possible:

```text
1. Apply tenant and permission filters.
2. Run lexical retrieval over `textsearch` for exact names, IDs, codes, and rare terms.
3. Run vector retrieval over approved embeddings.
4. Fuse or rerank results deterministically.
5. Run `RetrievalRevalidator` to revalidate source visibility, source_version, classification, redaction policy, and deterministic numeric authority before returning chunks.
6. Audit retrieval_id, query_hash, model, high-watermark, and result count.
```

## Index-selection policy

```text
Start with exact search and B-tree/GIN filters.
Enable HNSW only after recall@k and filtered-result-count evidence.
Use IVFFlat only after representative data exists and BENCH-AI evidence shows it beats HNSW for the target corpus.
Use halfvec, bit, sparsevec, or quantization only after a model-specific ADR and recall benchmark.
```

## Prohibited schema patterns

```text
No vector columns in core operational tables.
No embeddings of raw regulated data by default.
No AI table without tenant_id and permission_scope_hash.
No user-visible result without deterministic revalidation.
No AI mutation table that bypasses command_log.
```

## References

- pgvector supports exact and approximate nearest-neighbor search, vector/halfvec/bit/sparsevec storage types, and common distance metrics.
- pgvector approximate indexes include HNSW and IVFFlat; HNSW has better speed/recall tradeoff but higher build/memory cost, while IVFFlat requires representative data.
- pgvector filtering with approximate indexes is applied after index scan; retrieval templates therefore need ordinary PostgreSQL filters, possible partitioning, and iterative-scan evidence.
