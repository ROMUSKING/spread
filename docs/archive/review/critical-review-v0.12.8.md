---
version: "0.12.8"
last-reviewed: "2026-06-26"
status: "self-review"
---

# Critical Review v0.12.8: DuckDB and Specialized Plane Synergy

## Verdict

The pack now has a coherent post-MVP specialized-plane strategy. DuckDB is introduced as a derived analytics plane rather than a new source of truth or MVP dependency.

## Strengths

- Preserves Phase 0 command/outbox/invariant priorities.
- Keeps PostgreSQL as the control plane and projection hub.
- Separates TigerBeetle numeric correctness, pgvector semantic retrieval, and DuckDB analytics.
- Adds explicit alternative-strategy evaluation instead of silently assuming another engine.
- Adds analytics export lineage, SLOs, benchmarks, and gate evidence.

## Remaining risks

| Risk | Mitigation |
|---|---|
| Too many post-MVP planes increase cognitive load | Keep P0/MVP no-runtime-dependency stance and use the onramp/index map. |
| DuckDB direct PostgreSQL attach could harm OLTP | Make Parquet snapshots default; attach is internal-only and benchmark-gated. |
| Analytics snapshots may leak data | Require permission_scope_hash, data_classification, export_allowed, and audit. |
| AI could misuse analytics outputs | AI suggestions still route through command handlers and cite deterministic outputs. |

## Required next evidence

Open `P1-ANALYTICS-001` only after MVP vertical slice and P1-LEDGER/P1-AI readiness decisions are clear enough to define analytics-eligible projections.
