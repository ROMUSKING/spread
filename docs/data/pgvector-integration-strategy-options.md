---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "v0.13 strategy options; selected model normative after P1-AI evidence"
owner: "Data Platform Owner"
---

# pgvector Integration Strategy Options

## Decision summary

The selected pgvector strategy is:

```text
Permissioned derived chunk registry
+ hybrid lexical/vector retrieval
+ evidence-gated ANN indexes
+ optional dedicated semantic Postgres/pgvector database after scale evidence
```

pgvector is not an operational source of truth. It is the post-MVP semantic retrieval plane over approved, classified, versioned, permissioned chunks derived from PostgreSQL projections and governed artifacts.

The selected model intentionally mirrors the system-wide v0.13 rule:

```text
Commands mutate.
PostgreSQL governs identity, permissions, projections, source versions, and audit.
pgvector retrieves semantic candidates.
DuckDB computes deterministic analytical context over governed snapshots.
TigerBeetle proves conserved numeric movement after cutover.
```

## Evaluation criteria

| Criterion | Meaning |
|---|---|
| Security | Tenant, permission, classification, and regulated-data rules cannot be bypassed. |
| Retrieval quality | Combines exact terms, semantic similarity, metadata filters, and deterministic reranking. |
| MVP fit | Does not expand Phase 0 or the vertical slice. |
| PostgreSQL fit | Uses PostgreSQL strengths without overloading the OLTP edit path. |
| Migration ease | Can move from small in-database spike to isolated semantic database without changing domain logic. |
| Synergy | Works with outbox, DuckDB, TigerBeetle, audit, commands, and support workflows. |
| Operational load | Has explicit freshness, rebuild, recall, and index-maintenance controls. |

## Option A: No pgvector; keyword/full-text search only

**Score:** 6.8/10.

```text
Use PostgreSQL full-text search, trigram search, and deterministic filters only.
```

**Strengths:** simple, deterministic, easy to secure, no embedding provider dependency.

**Weaknesses:** weak synonym matching, poor natural-language retrieval, limited assistant context, weak duplicate/product/customer matching.

**Decision:** good fallback and required lexical component, but not sufficient as the post-MVP AI retrieval target.

## Option B: Vector columns on core ERP tables

Rejected phrase: vector columns on core operational tables are prohibited.

**Score:** 3.4/10.

```text
Add embedding vector(...) directly to customer, product, invoice, stock, audit, and workbook tables.
```

**Strengths:** simple join path for small prototypes.

**Weaknesses:** pollutes operational schemas, couples model dimensions to domain migrations, complicates RLS and retention, creates accidental edit-path maintenance, and makes embeddings look authoritative.

**Decision:** rejected. Core operational tables must not contain vector columns.

## Option C: Derived chunks in the primary PostgreSQL database

**Score:** 7.6/10 early, 5.8/10 at scale.

```text
ai_sources, ai_chunks, ai_embeddings_* live in the same PostgreSQL cluster as operational projections.
```

**Strengths:** easiest P1 spike, simple permissions, simple joins, one backup/PITR model, good for small pilot data.

**Weaknesses:** approximate vector indexes, embedding writes, and retrieval traffic can compete with OLTP if not isolated; high-cardinality tenant filtering needs careful index design.

**Decision:** allowed for P1-AI-001 spike and small internal pilots only. It is not the default production scale target unless BENCH-AI evidence shows no OLTP impact.

## Option D: Dedicated semantic PostgreSQL/pgvector database fed by projection/outbox jobs

**Score:** 9.1/10.

```text
PostgreSQL operational hub
  -> outbox/projection feed
  -> dedicated semantic_search database with pgvector
  -> retrieval API returns chunk IDs + citations
  -> API revalidates permissions and source freshness before user-visible output
```

**Strengths:** isolates vector index builds and retrieval load; keeps pgvector close to PostgreSQL semantics; preserves metadata joins; can still use B-tree, GIN, partial indexes, partitioning, and PITR; cleaner rollback.

**Weaknesses:** requires feed freshness, permission-scope propagation, cross-database observability, and revalidation logic.

**Decision:** selected production path after P1-AI evidence. The same `ai_sources` / `ai_chunks` / `ai_embeddings_*` contract is used whether the tables live in the primary cluster for a spike or a dedicated semantic database later.

## Option E: External vector database

**Score:** 6.9/10 later, 4.9/10 now.

```text
Export chunks to a separate vector database/service.
```

**Strengths:** may scale independently and provide specialized vector operations.

**Weaknesses:** weaker fit with PostgreSQL permission metadata, additional data-residency and retention surface, duplicated tenancy/RBAC, more complex backup/replay, and harder audit lineage.

**Decision:** defer. May be revisited only if pgvector fails recall/latency/cost evidence at production scale.

## Option F: DuckDB batch feature generation feeding pgvector

**Score:** 8.4/10 as a complementary path.

```text
DuckDB scans governed Parquet/Arrow snapshots
  -> produces candidate feature/cohort/source rows
  -> PostgreSQL ingests ai_sources/ai_chunks
  -> embedding workers generate pgvector embeddings
```

**Strengths:** strong for batch summarization, cohort generation, duplicate-detection candidate pools, support bundles, and offline re-embedding. Avoids heavy analytical scans on OLTP.

**Weaknesses:** not appropriate for fresh interactive retrieval by itself; snapshot freshness and export permission scopes must be enforced.

**Decision:** complementary, not a replacement for the permissioned chunk registry. DuckDB may prepare derived candidates; PostgreSQL/pgvector owns online retrieval state and permissioned chunk metadata.

## Option G: Hybrid search with pgvector + PostgreSQL full-text search

**Score:** 9.3/10.

```text
semantic candidates from vector distance
+ lexical candidates from tsvector/GIN
+ metadata filters
+ reciprocal-rank or deterministic reranking
+ final permission/source-version revalidation
```

**Strengths:** fixes pure-vector weakness on exact terms, SKUs, invoice IDs, supplier names, proper nouns, and codes; keeps deterministic search tools alongside semantic retrieval.

**Weaknesses:** requires rank-fusion tuning and careful observability.

**Decision:** selected query strategy. Pure vector search is not sufficient for ERP retrieval.

## Option H: pgvector as an AI query router over all planes

**Score:** 4.2/10.

```text
Embed plane/tool descriptions and let semantic similarity choose whether to query PostgreSQL, TigerBeetle, DuckDB, or command APIs.
```

**Strengths:** attractive demo path.

**Weaknesses:** probabilistic routing can choose unsafe tools, over-retrieve restricted context, or conflate semantic relevance with authority.

**Decision:** rejected. Tool selection can be assisted by semantic retrieval later, but deterministic API permissions and product-defined routes must remain authoritative.

## Option I: Per-tenant or high-cardinality partitioned semantic indexes

**Score:** 8.2/10 for large tenants; 6.5/10 as default.

```text
Partition ai_embeddings_* by tenant, region, or permission-scope bucket; create per-partition ANN indexes where justified.
```

**Strengths:** can improve filtering and tenant isolation for large corpora.

**Weaknesses:** high operational overhead and many indexes for small tenants.

**Decision:** optional scale pattern. Enable only after BENCH-AI-005 proves better recall/latency/cost than shared indexes with B-tree/GIN filters and iterative scans.

## Selected pgvector strategy

```text
1. MVP/Phase 0:
   no pgvector runtime dependency;
   prepare source_version, permission_scope_hash, data_classification, redaction_policy, projection_version.

2. P1-AI spike:
   create semantic retrieval contract tables;
   embed non-regulated pilot-safe derived chunks;
   benchmark exact, lexical, vector, and hybrid retrieval.

3. Early post-MVP:
   allow pgvector in an isolated schema or dedicated semantic database;
   retrieval API returns chunk IDs and citations;
   API revalidates permissions and source freshness.

4. Scale path:
   evaluate tenant/permission partitioning, halfvec/binary quantization, HNSW tuning, and external vector DB only after pgvector evidence.
```

## Synergy rules

### Rule 1: pgvector narrows context; deterministic planes answer facts

```text
pgvector -> candidate chunks and citations
PostgreSQL -> current object state, permissions, workflow
TigerBeetle/PostgreSQL projections -> authoritative numeric facts
DuckDB -> analytical aggregates over approved snapshots
Command layer -> only mutation path
```

### Rule 2: retrieval is hybrid by default

Every user-facing semantic retrieval path must include at least one deterministic retrieval/ranking component:

```text
tenant filter
permission_scope_hash filter
source_version freshness check
data_classification check
lexical/tsvector fallback for identifiers and exact terms
```

### Rule 3: approximate indexes need recall evidence

Approximate vector indexes may be used only after benchmark evidence records:

```text
recall@k versus exact search
p95/p99 latency
permission-filter selectivity
result count after filters
index build and maintenance cost
memory/storage footprint
```

### Rule 4: retrieval cannot become authorization

A chunk returned by vector similarity is not visible until deterministic permission checks confirm that the user may see the source object and chunk version.

### Rule 5: model changes are schema events

Embedding model, dimensions, vector type, distance metric, chunk template, redaction policy, and source projection version are part of retrieval lineage.

## Practical recommendation

Use **Option D + Option G** as the target:

```text
Dedicated semantic PostgreSQL/pgvector plane
+ permissioned derived chunks
+ hybrid pgvector/tsvector retrieval
+ DuckDB-assisted batch source generation where useful
+ deterministic revalidation before output
```

Use **Option C** only for P1 evidence and small internal pilots.

Reject **Option B** and **Option H**.
