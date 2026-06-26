---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP operational runbook"
---

# pgvector Retrieval Plane Runbook

## Purpose

Operate the post-MVP semantic retrieval plane without harming command latency, permissions, compliance, or deterministic reporting.

## Normal operation

1. Outbox event marks a projection source as changed.
2. Embedding worker updates `ai_source_registry` and `ai_chunk_registry`.
3. Worker enqueues embedding jobs for approved chunks only.
4. Embeddings are written to model-specific `ai_embeddings_*` tables.
5. Retrieval API executes hybrid retrieval and revalidates source visibility before returning chunks.
6. AI answer composition cites chunks and deterministic records.

## Incident classes

| Incident | Immediate action | Recovery |
|---|---|---|
| embedding lag above SLO | disable fresh AI claims; continue exact search | drain jobs, scale workers, report stale scope |
| regulated data embedded | disable affected model/table; rotate access if needed | delete embeddings, re-run redaction, compliance review |
| ANN recall below gate | fall back to exact/hybrid lexical mode | retune HNSW/IVFFlat or rebuild index |
| permission bypass test failure | disable retrieval API | patch filters, replay audit, security signoff |
| semantic DB feed lag | mark retrieval degraded | replay from outbox high-watermark |
| index build resource spike | pause ANN builds | build off-hours or on dedicated semantic DB |

## Operational rules

```text
- No pgvector query belongs in the ordinary edit path.
- No ANN result is user-visible before permission/source revalidation.
- No embedding table may contain blocked data_classification rows.
- Exact lexical retrieval remains the emergency fallback.
- Dedicated semantic DB feed state must store source_high_watermark_outbox_id.
```

## Observability

```text
ai_embedding_job_lag_seconds
ai_embedding_jobs_inflight
ai_retrieval_p95_ms
ai_retrieval_result_count
ai_retrieval_filtered_out_count
ai_ann_recall_at_10
ai_stale_source_result_count
ai_regulated_embedding_escape_count
ai_permission_bypass_count
ai_semantic_feed_lag_outbox_events
```
