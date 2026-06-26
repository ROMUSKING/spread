---
version: "0.13.1"
last-reviewed: "2026-06-26"
status: "review closure"
---

# Critical Review v0.13.1: Outbox Alternatives and MVP Preparedness

## Finding

The v0.13 architecture had strong specialized-plane boundaries but needed a more explicit post-MVP outbox strategy. Without it, pgvector, DuckDB, TigerBeetle repair, live updates, and external integrations could each invent their own delivery path.

## Closure

This update adds an event envelope contract, post-MVP alternatives, ADR-0024, P1-OUTBOX-001, benchmarks, runbook, transition plan, diagrams, OUTBOX invariants, SLOs, and manifest entries.
