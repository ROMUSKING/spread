---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "accepted"
---

# ADR-0023: v0.13 System Plane Integration Strategy

## Context

The pack now contains several specialized post-MVP planes: TigerBeetle for conserved numeric movement, pgvector for semantic retrieval, DuckDB for analytics/export, TypeScript workers for formula computation, and durable outbox/SSE for delivery. Without a system-level strategy, these could drift into separate sources of truth.

## Decision

Adopt **command-centered hub with derived specialized planes** as the v0.13 architecture strategy.

```text
PostgreSQL remains the control/projection/audit hub.
Specialized planes consume versioned contracts and produce derived outputs.
No specialized plane bypasses command, permission, audit, outbox, ledger, or compliance authority.
```

## Consequences

- Cross-plane artifacts require shared identity, lineage, classification, and permission metadata.
- Derived planes are rebuildable and evidence-gated.
- Multi-plane answers must cite deterministic sources and freshness metadata.
- Specialized-plane failures degrade derived features, not core command correctness.
- Teams must update `docs/data/v013-synergistic-integration-strategy.md` when adding a new plane.

## Rejected alternatives

- PostgreSQL-only monolith as post-MVP target.
- AI/query-router first architecture.
- DuckDB or warehouse-first analytics before command/outbox foundations.
- Direct ledger-to-analytics bypass of PostgreSQL metadata/projections.
- Customer arbitrary code/SQL spanning planes.
