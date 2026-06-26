---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP evidence gate"
---

# P1-OUTBOX-001: Post-MVP Outbox Fan-out and CDC Spike

**Owner:** Platform/SRE Owner  
**Approver:** Engineering Lead + Security Owner + Data Platform Owner  
**SLO reference:** `docs/slo-baseline.yml#benchmarks.BENCH-OUTBOX-001`  
**Waiver:** Not allowed for product workloads using external brokers or CDC.

## Goal

Prove that post-MVP outbox fan-out can serve specialized planes and external integrations without weakening the MVP command/outbox safety model.

## Requirements

1. PostgreSQL `outbox_events` remains the authoritative event log.
2. The CloudEvents-compatible envelope exists and is validated.
3. Every consumer has a checkpoint and idempotency contract.
4. Internal outbox dispatcher can deliver to derived-plane job queues without duplicate business effects.
5. CDC shadow bridge, if used, tails only the outbox table and does not infer business events from arbitrary table changes.
6. CDC/broker shadow output matches polling dispatcher output within the evidence window.
7. Broker outage does not block command commits.
8. CDC lag and replication slot/WAL retention alerts exist before CDC is admitted.
9. Duplicate broker delivery is deduplicated by `event_id` and `idempotency_key`.
10. Schema-version rollout supports old and new consumers during the compatibility window.
11. Regulated or blocked payloads cannot be routed to unauthorized sinks.
12. pgvector embedding workers consume only semantic-eligible events/chunks.
13. DuckDB export workers consume only analytics-export-eligible events/manifests.
14. TigerBeetle repair/reconciliation events are produced only after ledger projection repair state is recorded.
15. External integrations receive curated events only after contract test and customer/integration approval.
16. MVP polling reader is not regressed by envelope fields, dispatch attempts, or CDC/broker metadata.
17. High-churn outbox bloat and retention-gap chaos test passes before any fan-out rollout.

## Evidence

```text
ci://tests/outbox/event-envelope-contract
ci://tests/outbox/event-id-idempotency-key-stable
ci://tests/outbox/consumer-checkpoint-idempotency
ci://tests/outbox/derived-plane-job-replay
ci://tests/outbox/cdc-shadow-parity
ci://tests/outbox/broker-outage-does-not-block-command-commit
ci://tests/outbox/broker-duplicate-delivery-deduped
ci://tests/outbox/schema-version-rollout-compatible
ci://tests/outbox/regulated-payload-routing-blocked
ci://tests/outbox/pgvector-events-require-embedding-eligibility
ci://tests/outbox/duckdb-events-require-export-policy
ci://tests/outbox/tigerbeetle-events-require-projection-repair-state
ci://tests/outbox/mvp-polling-reader-not-regressed-by-envelope-fields
ci://tests/outbox/envelope-size-budget-enforced
ci://tests/chaos/outbox-bloat-high-churn-retention-gap
ci://benchmarks/BENCH-OUTBOX-001
ci://benchmarks/BENCH-OUTBOX-002
ci://benchmarks/BENCH-OUTBOX-003
ci://benchmarks/BENCH-OUTBOX-004
ci://benchmarks/BENCH-LIVE-OUTBOX-POLL-001
```
