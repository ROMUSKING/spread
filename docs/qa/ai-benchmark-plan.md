---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP benchmark plan"
---

# AI / pgvector Benchmark Plan

## Required benchmark set

| ID | Purpose | Blocks |
|---|---|---|
| BENCH-AI-001 | Permission-filtered retrieval p95/p99 and bypass checks. | P1-AI-001 |
| BENCH-AI-002 | Embedding job lag, re-embedding throughput, source-version invalidation. | P1-AI-001 |
| BENCH-AI-003 | Regulated-data block and command-mediated suggestion tests. | P1-AI-001 |
| BENCH-AI-004 | Hybrid lexical/vector retrieval quality versus pure vector and pure lexical. | P1-AI-001 |
| BENCH-AI-005 | Exact versus HNSW versus IVFFlat recall@k, p95, index build cost, and filtered result count. | P1-AI-001 |
| BENCH-AI-006 | Dedicated semantic database feed lag, replay, revalidation, and cutover readiness. | P1-AI-001 scale decision |

## Retrieval quality metrics

```text
recall@10 against exact vector baseline
precision@10 against labeled support/product/customer queries
identifier hit rate for SKUs, invoice IDs, supplier names, and command IDs
permission-filter result loss rate
regulated-data escape count
source-version stale result count
```

## Required datasets

```text
pilot-v1-small-ai-safe
  small synthetic ERP corpus for CI.

pilot-v1-semantic-10k
  10k chunks across customers/products/suppliers/runbooks/comments.

pilot-v1-permission-skew
  high-cardinality permission scopes to test filtering after ANN scans.
```

## Index experiments

```text
1. exact vector + B-tree/GIN filters
2. HNSW cosine with default settings
3. HNSW with iterative scans and tuned ef_search
4. IVFFlat after representative data exists
5. hybrid tsvector + vector rank fusion
6. optional halfvec/quantization only after recall evidence
```

## Required CI URIs

```text
ci://tests/ai/semantic-contract-schema-present
ci://tests/ai/no-vector-columns-in-core-operational-tables
ci://tests/ai/hybrid-search-uses-lexical-and-vector-components
ci://tests/ai/ann-filtering-recall-gate
ci://tests/ai/retrieval-revalidates-source-version
ci://tests/ai/dedicated-semantic-db-feed-replay
ci://benchmarks/BENCH-AI-004
ci://benchmarks/BENCH-AI-005
ci://benchmarks/BENCH-AI-006
```
