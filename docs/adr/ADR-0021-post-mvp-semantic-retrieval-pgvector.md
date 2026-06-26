---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "accepted-post-MVP-target"
---

# ADR-0021: Post-MVP Semantic Retrieval Plane with pgvector

## Context

The ERP will need AI-assisted retrieval after MVP: semantic search over rows, comments, policies, runbooks, event explanations, support bundles, and analytical summaries. This must not weaken command safety, permissions, audit, ledger correctness, or compliance boundaries.

## Decision

Use pgvector as the preferred post-MVP semantic retrieval plane, using the selected strategy in `docs/data/pgvector-integration-strategy-options.md`:

```text
permissioned derived chunk registry
+ hybrid pgvector/tsvector retrieval
+ evidence-gated ANN indexes
+ optional dedicated semantic PostgreSQL/pgvector database after scale evidence
```

## Alternatives considered

| Alternative | Decision |
|---|---|
| Full-text search only | Keep as fallback and hybrid component, but not sufficient for semantic retrieval. |
| Vector columns on core ERP tables | Rejected; pollutes operational schemas and couples model dimensions to core migrations. |
| Primary PostgreSQL pgvector schema | Allowed only for P1 spike/small pilots. |
| Dedicated semantic PostgreSQL/pgvector database | Selected production scale path after evidence. |
| External vector database | Deferred unless pgvector cannot meet evidence gates. |
| DuckDB batch source generation | Complementary; not the online retrieval store. |
| AI semantic query router | Rejected until deterministic tool boundaries are mature. |

## Consequences

- Embeddings are derived projections and can be rebuilt.
- Retrieval APIs must enforce tenant, permission, classification, and source-version checks.
- Hybrid lexical/semantic retrieval is the default user-facing query model.
- ANN indexes require recall and filtered-result-count evidence before rollout.
- AI suggestions cannot mutate data except through command handlers.
- Regulated or blocked data is not embedded without compliance sign-off.
- DuckDB can produce derived chunk candidates from governed artifacts, but PostgreSQL/pgvector owns online permissioned retrieval metadata.

## Non-goals

- No pgvector dependency in Phase 0.
- No vector columns in core ERP tables.
- No AI authorization.
- No AI direct writes.
- No vector similarity as numeric/accounting/inventory truth.
