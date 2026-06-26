---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "canonical strategy options"
---

# External Integration Strategy Options

## Decision

The selected post-MVP strategy is a **governed integration adapter framework over the PostgreSQL command/outbox hub**.

```text
Inbound systems -> ExternalIntegrationAdapter -> staging / command proposal -> command handler
Outbound systems <- integration dispatcher / connector / webhook <- PostgreSQL outbox
```

External systems are not new sources of truth for ERP state by default. They are producers of command proposals, consumers of governed outbox events, or sources for derived read-side/search/analytics artifacts.

## Non-goals

- No direct third-party API call inside the command transaction.
- No direct write from a connector into operational tables.
- No partner database access to production PostgreSQL.
- No external system writing TigerBeetle directly.
- No AI/analytics result becoming externally actionable without RetrievalRevalidator and command mediation.
- No regulated-data export unless the sink, connection, and payload are explicitly approved.

## Alternatives evaluated

| Option | Score | Decision | Notes |
|---|---:|---|---|
| A. Public REST API only | 7.4 | Useful but insufficient | Good for command submission and reads; weak for event-driven partners. |
| B. Webhooks only | 6.9 | Subset only | Good outbound notification; weak inbound, replay, and backfill. |
| C. Outbox-driven integration dispatcher | 9.0 | Selected foundation | Preserves PostgreSQL outbox authority and retry/dead-letter behavior. |
| D. Async event API / broker fan-out | 8.2 | Post-MVP after P1-OUTBOX | Good for high-throughput consumers; requires schema and replay governance. |
| E. iPaaS/connector marketplace | 7.8 | Later channel | Useful commercially; must sit behind the adapter contract. |
| F. EDI/file/SFTP batch bridge | 7.5 | Domain-specific later | Important for ERP; must use import staging and export manifests. |
| G. CDC directly from operational tables | 4.5 | Rejected by default | Bypasses business event semantics and classification. |
| H. External warehouse/lakehouse share | 6.8 | Analytics-only | Must consume DuckDB/export artifacts, not operational tables. |
| I. External system as source of truth | 3.0 | Rejected default | Requires separate object-family ADR and reconciliation ownership. |
| J. Direct database access for partners | 1.5 | Rejected | Breaks permission, audit, schema evolution, and source-of-truth boundaries. |

## Selected model

```text
PostgreSQL integration registry
  -> integration connection state, credentials metadata, external object mappings, checkpoints
Command layer
  -> only mutation path for inbound changes
Outbox
  -> only outbound business event source
Integration dispatcher
  -> webhooks, REST callbacks, connector jobs, file/EDI export, future broker sink
Dead-letter and replay
  -> operational recovery without command ambiguity
```

## External integration modes

| Mode | Direction | Phase | Contract |
|---|---|---|---|
| Public REST API | Inbound/read | P1 | OpenAPI + command idempotency |
| Webhooks | Outbound | P1 | OpenAPI webhooks + event envelope |
| Async event API | Outbound | P1/P2 | AsyncAPI + CloudEvents-compatible envelope |
| File/EDI import | Inbound | P1/P2 | Import staging + command proposal |
| File/EDI export | Outbound | P1/P2 | Export manifest + outbox trigger |
| SCIM provisioning | Inbound identity | P1/P2 | SCIM + tenant admin approval |
| iPaaS connector | Bidirectional | P2 | Adapter SDK + certification gate |
| Partner analytics share | Outbound read-only | P2 | DuckDB/Parquet export + classification controls |

## How this affects post-MVP planes

| Plane | Synergy | Risk | Required guardrail |
|---|---|---|---|
| TigerBeetle | Integration can reconcile payments, inventory, credits, and reservations against authoritative numeric movements. | External connector could double-post money/stock. | External numeric changes must become ledgerable commands with deterministic IDs. |
| pgvector | External docs, tickets, catalog data, and partner notes can enrich retrieval. | Sensitive external text can leak into embeddings. | Classification, redaction, and RetrievalRevalidator required. |
| DuckDB | Connector history, import quality, partner reconciliation, and export bundles are strong analytics use cases. | Analytics export can be mistaken for operational state. | Export manifests and deterministic source references required. |
| Outbox | Existing event envelope becomes the outbound integration backbone. | Fan-out fields can bloat polling path. | Demand-filtered polling performance contract remains release-blocking. |
| Command layer | External writes use the same idempotency and unknown-outcome recovery model as UI edits. | Inbound connectors may retry with different payloads. | `external_operation_id`, command ID, and payload hash parity required. |
| RetrievalRevalidator | AI/analytics/integration combined answers are revalidated before display or action. | Derived data could surface stale or unauthorized external facts. | Revalidator must check source plane, version, classification, and authority. |

## Recommended adoption path

```text
Phase 0 preparedness
  -> schema/metadata only; no runtime connector dependency
P1-INTEGRATION-001
  -> one internal webhook + one import-staging connector with synthetic data
P1/P2 pilot
  -> customer-approved SaaS connector or file bridge
P2 marketplace
  -> adapter SDK and certification gate
P3 ecosystem
  -> versioned event API, partner sandbox, SCIM/SSO automation, connector catalog
```

## Scoring summary

The highest scoring approach is not a connector-first platform. It is a command/outbox-centered adapter framework because it reuses the system's existing authority, idempotency, audit, retry, classification, and recovery contracts.


## v0.14.1 review-closure constraints

All integration strategies are subordinate to: scan/quarantine and schema validation before command proposal; credential refs bound to scoped service accounts; SDK import restrictions; RetrievalRevalidator for integration-derived semantic/analytics data; and outbox `event_id` for outbound identity.
