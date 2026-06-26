---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP evidence gate"
---

# P1-SYNERGY-001: System Integration Boundary Gate

**Owner:** Engineering Lead  
**Approvers:** SRE, Security, Compliance, Domain Owners  
**Waiver:** Not allowed for cross-plane mutation paths.

## Goal

Prove that TigerBeetle, pgvector, DuckDB, formula workers, and delivery components interoperate through PostgreSQL contracts and projection lineage without introducing hidden mutation paths.

## Requirements

1. Every cross-plane payload includes tenant, source version, schema hash, permission scope, and data classification where applicable.
2. User-visible mutations always return to command handlers.
3. Specialized plane outages degrade feature surfaces without corrupting operational state.
4. pgvector retrieval cannot authorize access or decide command validity.
4a. `RetrievalRevalidator` must run before user-visible cross-plane AI/analytics answers.
5. DuckDB analytics cannot write operational PostgreSQL tables.
6. TigerBeetle customer-visible analytics uses PostgreSQL ledger projections, not direct TigerBeetle customer reads.
7. Formula workers cannot bypass command/audit/outbox state transitions.
8. SSE delivery remains downstream of durable outbox events.

## Required evidence

```text
ci://tests/synergy/no-cross-plane-direct-mutation
ci://tests/synergy/cross-plane-envelope-complete
ci://tests/synergy/specialized-plane-failure-degrades-safely
ci://tests/synergy/ai-answer-cites-deterministic-records
ci://tests/synergy/retrieval-revalidator-runs-before-cross-plane-answer
ci://tests/synergy/retrieval-revalidator-blocks-direct-mutation
ci://tests/synergy/duckdb-no-operational-writeback
ci://tests/synergy/tigerbeetle-analytics-via-postgres-projection
ci://tests/synergy/formula-worker-no-command-bypass
ci://benchmarks/BENCH-SYNERGY-001
ci://benchmarks/BENCH-SYNERGY-002
ci://benchmarks/BENCH-SYNERGY-003
```

## SLO reference

`docs/slo-baseline.yml#benchmarks.BENCH-SYNERGY-001`
