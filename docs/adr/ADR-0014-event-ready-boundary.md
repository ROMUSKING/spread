# ADR-0014: Event-Ready Boundary

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required for Phase 0

## Context

The product needs auditability, live updates, integration hooks, and unknown-outcome recovery, but the operational source of truth remains normalized current-state ERP tables.

## Decision

Use three distinct event-related layers:

1. `audit_events` record who changed what and why.
2. `domain_events` record canonical business events.
3. `outbox_events` are delivery projections used by SSE, polling replay, and future integration dispatch.

A command is considered committed only after the current-state mutation and all required audit/domain/outbox records commit in the same database transaction.

## Consequences

- `domain_events` are not a substitute for current-state tables in MVP.
- `outbox_events` are the durable delivery source, not `NOTIFY`.
- Every event record must carry `tenant_id`, `command_id`, `trace_id`, and `correlation_id`.
- Event-boundary tests must prove command/current/audit/domain/outbox correlation.

## Acceptance

- `AUD-001` invariant passes.
- Command vertical slice proves end-to-end correlation.
- Outbox replay can rebuild client delivery state without relying on notifications.
