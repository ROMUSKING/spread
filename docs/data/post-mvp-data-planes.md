---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP architecture baseline"
---

# Post-MVP Data Plane Strategy

## Purpose

This document defines how specialized post-MVP data planes work together without weakening the Phase 0/MVP safety model.

The MVP remains:

```text
PostgreSQL operational/control plane
  + command_log
  + audit/domain/outbox events
  + permissioned projections
  + PostgreSQL MVP NumericLedgerPort adapter
```

Post-MVP specialized planes are admitted only through evidence gates:

```text
TigerBeetle -> conserved numeric ledger plane
pgvector    -> permissioned semantic retrieval plane
DuckDB      -> derived analytical/export plane
```

None of these planes may bypass command handlers, tenant isolation, audit, outbox, workflow, or compliance gates.

## Chosen integration strategy

The selected strategy is **Derived Artifact Planes with PostgreSQL Control**.

```text
PostgreSQL remains the system-of-record control plane.
TigerBeetle records authoritative conserved numeric movement after cutover.
pgvector indexes permissioned semantic chunks derived from PostgreSQL projections.
DuckDB analyzes governed Parquet/Arrow artifacts and read-only PostgreSQL projections.
```

This is intentionally not a monolithic warehouse, not an AI-first architecture, and not a DuckDB-in-the-edit-path design.

## Plane responsibilities

| Plane | Role | Authoritative for | Not authoritative for |
|---|---|---|---|
| PostgreSQL | Operational control plane | business objects, workflow, permissions, command/audit/outbox, projections | TigerBeetle numeric balances after cutover, vector similarity, offline OLAP artifacts |
| TigerBeetle | Numeric ledger plane | conserved numeric transfers and balances after ledger cutover | workflow, permissions, business metadata, analytics, semantic retrieval |
| pgvector | Semantic retrieval plane | embedding-nearest-neighbor search over approved chunks | authorization, mutation, financial/stock truth |
| DuckDB | Analytical/export plane | derived analytical query results over governed snapshots | operational writes, command status, source-of-truth balances |

## Data flow

```text
Operational command
  -> PostgreSQL command_log + domain/audit/outbox
  -> NumericLedgerPort for ledger-shaped numeric movement
  -> PostgreSQL projections
  -> outbox-driven export/embedding jobs
  -> pgvector chunks for semantic retrieval
  -> DuckDB-ready Parquet/Arrow analytical artifacts
```

## Synergy principles

1. **One write path.** Mutations enter only through command handlers.
2. **Many derived read planes.** Specialized planes consume projections/artifacts, not raw mutable state.
3. **Shared identifiers.** All planes carry `tenant_id`, `object_type`, `object_id`, `source_version`, `command_id`, and when relevant `movement_group_id`.
4. **Shared classification.** Every artifact/chunk/export inherits data classification and retention policy.
5. **Rebuildability.** pgvector and DuckDB outputs are rebuildable from PostgreSQL/TigerBeetle-derived sources.
6. **Evidence gates.** Each specialized plane has its own P1 admission gate and benchmark.

## Alternative integration strategies evaluated

| Strategy | Description | Score | Decision |
|---|---|---:|---|
| A. Derived Artifact Planes with PostgreSQL Control | PostgreSQL projections feed pgvector and DuckDB artifacts; TigerBeetle is numeric authority after cutover. | **9.3** | **Selected** |
| B. PostgreSQL-centric extensions only | Use pgvector and pg_duckdb inside PostgreSQL; fewer moving parts. | 7.7 | Useful later, but risky for operational isolation. |
| C. Direct DuckDB over PostgreSQL read replicas | DuckDB attaches to PostgreSQL/read replicas for ad hoc analytics. | 7.4 | Allowed as controlled bridge, not default. |
| D. Central external warehouse first | Export to warehouse/lakehouse before DuckDB/AI. | 6.8 | Overweight for post-MVP evidence pass. |
| E. Event lake only | All analytics and AI consume event streams only. | 6.2 | Good audit source, weak for current-state joins without projection work. |
| F. Embed analytics in app workers | Application workers run DuckDB against local files. | 5.9 | Useful for internal tools, not multi-tenant product default. |
| G. AI/agent-first query router | LLM routes to PostgreSQL/TigerBeetle/DuckDB dynamically. | 4.2 | Rejected until deterministic APIs and permission checks are mature. |

## Selected strategy details

### PostgreSQL prepares all derived planes

PostgreSQL owns:

```text
exportable_projection_registry
source_version
permission_scope_hash
data_classification
retention_policy
redaction_policy
artifact_watermark
```

Do not export raw tables by default. Export named projections with documented semantics.

### TigerBeetle strengthens numeric correctness

DuckDB may analyze TigerBeetle-derived projections, but it must not be used to calculate authoritative financial or stock balances. Analytics can explain or aggregate ledger-derived facts, but numeric truth comes from the ledger/projection reconciliation path.

### pgvector supplies semantic narrowing

AI retrieval can identify relevant rows, events, comments, or policies. It cannot authorize access or decide command validity. The retrieval API must apply deterministic permission filters before returning chunks to an assistant.

### DuckDB supplies analytical breadth

DuckDB handles read-heavy analytical work:

```text
period reporting
cohort analysis
stock movement summaries
spreadsheet pivot acceleration
offline support exports
AI context-pack generation
benchmark and reconciliation analysis
```

DuckDB is not part of the edit hot path.

## Early preparation before post-MVP adoption

MVP should add or preserve these fields in projections and outbox envelopes:

```text
tenant_id
object_type
object_id
source_version
projection_version
command_id
movement_group_id
created_at
updated_at
effective_at
data_classification
permission_scope_hash
retention_class
redaction_policy
export_allowed
embedding_allowed
analytics_allowed
```

## Non-goals

- No DuckDB dependency in Phase 0 vertical slice.
- No pgvector dependency in Phase 0 vertical slice.
- No AI mutation path outside command handlers.
- No DuckDB writes back to operational PostgreSQL by default.
- No direct export of regulated data without compliance owner approval.
- No semantic search as an authorization mechanism.

## Evidence gates

| Gate | Purpose |
|---|---|
| P1-LEDGER-001 | TigerBeetle numeric ledger substrate and migration evidence. |
| P1-AI-001 | pgvector permissioned semantic retrieval evidence. |
| P1-ANALYTICS-001 | DuckDB analytical/export plane evidence. |

## Decision rule

Add a specialized plane only if it reduces operational risk or load without becoming another source of truth.


## v0.13 system strategy

The normative v0.13 system-level strategy is `docs/data/v013-synergistic-integration-strategy.md`. This document remains the post-MVP plane map; the v0.13 document controls cross-plane authority boundaries and admission rules.
