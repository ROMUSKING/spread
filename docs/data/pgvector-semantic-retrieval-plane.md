---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP target architecture"
---

# pgvector Semantic Retrieval Plane

## Decision

pgvector is the preferred post-MVP semantic retrieval substrate for AI-assisted search and explanation over permissioned ERP projections.

The selected integration model is documented in:

```text
docs/data/pgvector-integration-strategy-options.md
```

The canonical schema contract is documented in:

```text
docs/data/semantic-retrieval-contract.md
```

## Selected model

```text
Permissioned derived chunks
+ PostgreSQL semantic contract
+ hybrid pgvector/tsvector retrieval
+ evidence-gated HNSW/IVFFlat indexes
+ optional dedicated semantic PostgreSQL/pgvector database after scale evidence
```

This is the selected strategy because it keeps pgvector close to PostgreSQL permission/projection metadata while preventing vector indexes and embedding jobs from becoming part of the edit hot path.

## Boundary

```text
PostgreSQL projections
  -> ai_source_registry
  -> ai_chunk_registry + tsvector
  -> embedding jobs via durable outbox
  -> model-specific pgvector embedding tables
  -> hybrid retrieval API
  -> deterministic permission/source revalidation
```

Embeddings are derived projections. They are not operational source of truth.

## Allowed uses

- semantic search over approved rows, comments, policies, runbooks, and support notes;
- duplicate detection for products/customers/suppliers;
- relevant-context retrieval for AI answers;
- explanatory retrieval before deterministic PostgreSQL/TigerBeetle/DuckDB queries;
- support triage over redacted diagnostic artifacts;
- DuckDB-assisted batch chunk generation from governed snapshots.

## Prohibited uses

- AI mutation without command handler;
- similarity search as authorization;
- embedding regulated data by default;
- embedding raw TigerBeetle transfers as authoritative truth;
- using LLM output as command validity evidence;
- vector columns in core operational tables;
- pgvector queries in the ordinary edit path.

## Interaction with DuckDB

DuckDB and pgvector are complementary. Normative rule: pgvector narrows semantic context; DuckDB computes deterministic analytical aggregates over approved artifacts.

DuckDB and pgvector are complementary:

```text
DuckDB computes deterministic analytics over governed snapshots.
DuckDB may generate derived candidate sources/chunks in batch.
pgvector serves online semantic retrieval over approved chunks.
PostgreSQL validates permissions and source versions before output.
```

Example:

```text
User asks: "Why did margin drop for supplier X?"
1. pgvector retrieves relevant supplier notes, pricing policy, and recent event summaries.
2. DuckDB computes margin trend from approved analytical artifacts.
3. TigerBeetle/PostgreSQL projections provide authoritative ledger-derived amounts.
4. Answer cites deterministic records, not vector similarity alone.
```

## Index posture

```text
P1 baseline: exact search + B-tree/GIN filters.
Default query model: hybrid lexical + semantic retrieval.
ANN admission: HNSW/IVFFlat only after recall@k, filtered-result-count, p95/p99, and index-cost evidence.
Scale path: dedicated semantic PostgreSQL/pgvector database or partitioned embedding tables after BENCH-AI-006.
```

## Preparation now

MVP should preserve:

```text
source_version
permission_scope_hash
data_classification
redaction_policy_version
embedding_allowed
analytics_allowed
object_type/object_id
projection_version
source_high_watermark_outbox_id
schema_hash
```

Do not put vector columns on core operational tables.
