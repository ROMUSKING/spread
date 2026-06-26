---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP evidence gate"
---

# P1-SYNERGY-001: System Plane Integration Evidence Gate

**Owner:** Engineering Lead + Data Platform Owner  
**Approvers:** SRE, Security, Compliance, Domain Owner  
**Waiver:** Not allowed for command/audit/permission bypass

## Purpose

Prove that PostgreSQL, TigerBeetle, pgvector, DuckDB, formula workers, outbox/SSE, and command recovery work as bounded system elements rather than independent sources of truth.

## Requirements

1. Every cross-plane artifact includes tenant, object, command, trace, source-version, schema-hash, classification, and permission-scope metadata where applicable.
2. No specialized plane has a direct operational write path into source-of-truth ERP tables.
3. AI/pgvector can retrieve context but cannot authorize or mutate.
4. DuckDB can analyze governed artifacts but cannot write operational PostgreSQL tables.
5. TigerBeetle movement remains behind `NumericLedgerPort` and reconciliation/cutover policy.
6. Formula workers publish projections/status, not source-of-truth mutations.
7. Outbox watermarks drive derived jobs and are visible in freshness metadata.
8. Failure of pgvector, DuckDB, formula workers, or export jobs does not block ordinary command processing.
9. Multi-plane answers include deterministic PostgreSQL/TigerBeetle-derived source references and freshness metadata.
10. Security/compliance owners can block export, embedding, analytics, or ledger cutover independently.

## Evidence

```text
ci://tests/data-plane/cross-plane-lineage-propagation
ci://tests/data-plane/permission-scope-consistency
ci://tests/data-plane/no-specialized-plane-operational-write-path
ci://tests/data-plane/stale-plane-degradation
ci://tests/data-plane/multi-plane-query-deterministic-source-references
ci://tests/data-plane/outbox-watermark-derived-job-freshness
ci://tests/data-plane/specialized-plane-failure-does-not-block-edit
ci://benchmarks/BENCH-SYNERGY-001
```

## SLO reference

`docs/slo-baseline.yml#benchmarks.BENCH-SYNERGY-001`
