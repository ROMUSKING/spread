---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "accepted"
---

# ADR-0023: System Plane Integration Strategy

## Decision

Adopt **PostgreSQL control plane with evidence-gated specialized derived planes** as the v0.13 system integration strategy.

## Accepted architecture

```text
PostgreSQL = command, workflow, permissions, audit, outbox, projection lineage
TigerBeetle = numeric ledger plane after cutover
pgvector = semantic retrieval plane after P1-AI evidence
DuckDB = analytics/export/reconciliation plane after P1-ANALYTICS evidence
Formula workers = incremental formula compute plane
SSE/polling = delivery plane sourced from PostgreSQL outbox
```

## Rejected defaults

- PostgreSQL-only post-MVP monolith.
- Direct DuckDB customer queries against production PostgreSQL.
- Direct ledger-to-DuckDB customer analytics bypassing PostgreSQL lineage.
- AI/agent orchestration as the integration authority.
- Early microservice/database-per-capability split.

## Consequences

- MVP runtime remains intentionally narrow.
- Post-MVP adoption is adapter/projection based.
- Every cross-plane artifact must carry tenant, permission, classification, schema, and high-watermark metadata.
- Specialized plane failures degrade features but do not corrupt operational state.
- New engines require a gate and explicit SLO/CI evidence before customer-visible use.
