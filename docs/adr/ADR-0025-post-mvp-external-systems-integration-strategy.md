# ADR-0025: Post-MVP External Systems Integration Strategy

**Version:** 0.14  
**Date:** 2026-06-26  
**Status:** Accepted planning baseline; implementation evidence required by P1-INTEGRATION-001

## Context

The ERP will need to integrate with accounting, CRM, warehouse, identity, support, procurement, iPaaS, file/EDI, and partner analytics systems. The core architecture already uses command identity, durable outbox, PostgreSQL projections, and evidence-gated specialized planes.

## Decision

Adopt a governed adapter framework:

```text
Inbound = external payload -> staging / command proposal -> command handler
Outbound = PostgreSQL outbox -> dispatcher / webhook / connector / CDC bridge
```

External systems are not source-of-truth systems for core ERP state by default.

## Consequences

- Phase 0 only prepares stable identity, outbox envelope, classification, and mapping contracts.
- P1-INTEGRATION-001 must prove idempotency, retry, dead-letter, auth, classification, and command-mediated writes.
- Integration data can enrich pgvector, DuckDB, and TigerBeetle-derived workflows only through governed projections/events.
- One-off direct connector writes are prohibited.

## Rejected alternatives

- Direct database access for partners.
- Direct broker write from command handlers.
- CDC from arbitrary operational tables as the primary integration API.
- External system as authority without a bounded object-family ADR.
