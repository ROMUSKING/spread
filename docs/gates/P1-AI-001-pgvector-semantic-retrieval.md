---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP evidence gate"
---

# P1-AI-001: Permissioned Semantic Retrieval with pgvector

**Owner:** Data Platform Owner + Security Owner  
**Approver:** Engineering Lead + Compliance Owner  
**Waiver:** Not allowed for tenant/permission bypass

## Scope

Prove pgvector can support semantic retrieval over permissioned, derived ERP chunks without bypassing command, permission, compliance, analytics, or ledger guarantees.

## Requirements

1. Embeddings are generated only from approved `ai_chunk_registry` rows derived from permissioned projections.
2. Retrieval applies tenant, permission, classification, and source-version checks before returning user-visible chunks.
2a. `RetrievalRevalidator` in `docs/dev/retrieval-revalidator.md` must run before any user-visible chunk, answer, or AI-generated suggestion is returned.
3. Regulated data is blocked unless compliance-approved.
4. Embedding invalidation follows source version and outbox high-watermark changes.
5. AI suggestions mutate data only through command handlers.
6. Deterministic PostgreSQL/TigerBeetle/DuckDB queries provide numeric answers; vector similarity only retrieves context.
7. Exact, HNSW, and IVFFlat search are benchmarked before broad rollout.
8. Hybrid `tsvector` + pgvector retrieval is benchmarked against pure lexical and pure vector retrieval.
9. Vector columns are prohibited from core operational tables.
10. Production scale path is either isolated schema with proven no-OLTP impact or dedicated semantic PostgreSQL/pgvector database.
11. DuckDB-generated AI features may enter the semantic plane only through the governed `ai_source_registry` / `ai_chunk_registry` contract.
12. ANN indexes require recall@k, filtered-result-count, p95/p99 latency, and index-maintenance evidence.

## Evidence

```text
ci://tests/ai/semantic-contract-schema-present
ci://tests/ai/tenant-permission-filtered-retrieval
ci://tests/ai/regulated-data-embedding-block
ci://tests/ai/embedding-invalidation-source-version
ci://tests/ai/suggestions-require-command
ci://tests/ai/no-vector-columns-in-core-operational-tables
ci://tests/ai/embeddings-derived-only
ci://tests/ai/hybrid-search-uses-lexical-and-vector-components
ci://tests/ai/ann-filtering-recall-gate
ci://tests/ai/retrieval-revalidates-source-version
ci://tests/ai/retrieval-revalidator-required
ci://tests/ai/retrieval-revalidator-filters-stale-source
ci://tests/ai/retrieval-revalidator-blocks-regulated-data
ci://tests/ai/retrieval-revalidator-requires-deterministic-ledger-fact
ci://tests/api/retrieval-revalidator-openapi-contract
ci://tests/ai/dedicated-semantic-db-feed-replay
ci://benchmarks/BENCH-AI-001
ci://benchmarks/BENCH-AI-002
ci://benchmarks/BENCH-AI-003
ci://benchmarks/BENCH-AI-004
ci://benchmarks/BENCH-AI-005
ci://benchmarks/BENCH-AI-006
```

## SLO reference

`docs/slo-baseline.yml#benchmarks.BENCH-AI-001`


## v0.13.3 revalidator evidence

- `ci://tests/ai/retrieval-revalidator-middleware-required`
- `ci://tests/ai/retrieval-revalidator-cache-cannot-expand-permissions`
- `ci://benchmarks/BENCH-AI-REVALIDATOR-001`
