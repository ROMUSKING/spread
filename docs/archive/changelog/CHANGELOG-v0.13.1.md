# CHANGELOG v0.13.1

**Date:** 2026-06-26  
**Status:** Outbox fan-out readiness baseline

## Added

- Event envelope contract.
- Post-MVP outbox fan-out strategy options.
- ADR-0024.
- P1-OUTBOX-001 gate.
- Outbox fan-out benchmark plan, runbook, transition plan, diagrams, review closure.

## Changed

- Promoted active pack metadata to v0.13.1.
- Updated canonical `outbox_events` DDL with stable event identity, routing, partitioning, schema, payload hash, classification, target-plane fields, consumer checkpoints, dispatch attempts, and event schema registry.
- Added OUTBOX invariants, SLOs, benchmarks, and CI manifest entries.

## Decision

MVP remains PostgreSQL polling-first. Post-MVP brokers/CDC are permitted only after P1-OUTBOX-001 evidence.
