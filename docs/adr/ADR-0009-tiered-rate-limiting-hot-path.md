# ADR-0009: Tiered Rate Limiting Without PostgreSQL Hot-Path Counters

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required for Phase 0

## Context

Single-cell edit latency is a product-critical SLO. Synchronous PostgreSQL rate-limit counter writes on every ordinary edit would add write amplification and contention.

## Decision

Use edge controls and per-instance in-memory token buckets for ordinary edits. Use active-instance budget division and coarse PostgreSQL ceilings for high-risk commands and asynchronous reconciliation.

## Consequences

- Ordinary edits avoid counter writes before business execution.
- Cross-instance abuse is mitigated by conservative local budgets.
- Redis remains out of MVP unless later evidence shows it is required.
- PostgreSQL remains available for high-risk ceilings and audit-worthy rate-limit decisions.
- Stale heartbeats are cleaned by a scheduled job and active count is treated as eventually consistent.

## Acceptance

- `BENCH-RATE-001` p95 overhead is <= 5 ms.
- `RATE-001` invariant proves ordinary edits do not synchronously write PostgreSQL counters.
- 429 responses include `Retry-After`, `RateLimit`, and `RateLimit-Policy`.
