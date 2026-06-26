# Changelog v0.14

**Date:** 2026-06-26  
**Status:** External integration strategy baseline

## Added

- Post-MVP external-system integration strategy.
- External integration contract for connector registry, inbound intake, outbound delivery, external object mappings, and reconciliation checkpoints.
- ADR-0025 for external-system integration strategy.
- P1-INTEGRATION-001 evidence gate.
- External integration benchmark plan, runbook, transition plan, diagrams, and security boundary.
- EXT invariants for command-mediated inbound mutations, governed outbound events, external object mapping, secret handling, reconciliation, and derived-plane revalidation.

## Decision

External systems are post-MVP governed connectors, not Phase 0 dependencies. Outbound integrations originate from outbox envelopes. Inbound mutations enter through command handlers. Imported external snapshots are staged, classified, reconciled, and never direct operational writes.

## MVP impact

Phase 0 prepares identifiers, envelope fields, classification metadata, and object mapping hooks. It does not build a connector runtime.
