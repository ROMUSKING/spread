---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "normative post-MVP strategy options"
---

# Post-MVP Outbox Integration Strategy Options

## Decision

The selected post-MVP strategy is:

```text
PostgreSQL authoritative transactional outbox
+ MVP polling/SSE delivery
+ CloudEvents-compatible event envelope now
+ post-MVP evidence-gated fan-out dispatcher and CDC bridge
+ optional broker adoption for derived planes and integrations only
```

PostgreSQL remains the commit-adjacent source of truth for mutation outcomes, audit correlation, domain event projection, and replay. External transports may improve fan-out, integration, and specialized-plane scheduling, but they must not become the authority for whether a command mutated ERP state.

## Non-goals

- No external broker in the MVP edit path.
- No direct broker write from command handlers as a substitute for inserting `outbox_events`.
- No specialized plane consumes operational tables directly to avoid the outbox contract.
- No event-stream-first rewrite before Phase 0/P0-LIVE evidence exists.
- No claim of exactly-once business effects from a broker. Consumers remain idempotent.

## MVP preparedness requirements

MVP should add cheap structural preparation without adding a broker dependency:

```text
1. Stable event_id independent from outbox_id.
2. Deterministic idempotency_key.
3. route_key and partition_key.
4. schema_version, data_schema, payload_hash, trace_id, correlation_id.
5. tenant_id, visibility_scope, data_classification.
6. payload_ref for large or regulated payloads.
7. consumer checkpoints by consumer_id, tenant_id or bucket, and outbox_id.
8. Derived-plane jobs consume outbox envelopes, never raw table change inference.
```

## Alternatives evaluated

| Strategy | MVP fit | Post-MVP fit | Decision |
|---|---:|---:|---|
| PostgreSQL polling only | 9 | 7 | MVP default and permanent fallback. |
| Polling plus `LISTEN/NOTIFY` wake-up | 6 | 7 | Optional after P0-LIVE evidence only. |
| Application outbox dispatcher | 7 | 9 | First post-MVP adoption step. |
| Debezium Outbox Event Router to Kafka/Redpanda | 3 | 9 | Primary CDC/broker candidate after integration pressure exists. |
| PostgreSQL logical replication/custom CDC | 3 | 8 | Evidence-gated fallback if Debezium/managed CDC is unsuitable. |
| NATS JetStream fan-out | 4 | 8 | Strong internal derived-plane job fan-out candidate. |
| Managed cloud event bus | 3 | 7 | Integration sink only, not internal authority. |
| Workflow engine consumer | 3 | 7 | Allowed only if mutations re-enter through command handlers. |
| Direct broker write in command transaction | 2 | 2 | Rejected. |
| Event stream as operational source of truth | 2 | 5 | Rejected for this roadmap. |

## Selected adoption path

```text
Stage 0: MVP-ready outbox envelope
  - Add stable event_id, idempotency_key, route_key, partition_key, payload_hash, data_classification, visibility_scope.
  - Keep polling-first SSE and internal workers.

Stage 1: Internal outbox dispatcher
  - Dispatch derived-plane jobs from PostgreSQL outbox.
  - Add consumer checkpoints and delivery-attempt records.
  - Keep all consumers idempotent.

Stage 2: CDC shadow bridge
  - Debezium/custom CDC tails outbox only.
  - Publish to a non-authoritative broker topic/stream.
  - Compare CDC stream with polling dispatcher.

Stage 3: Strict shadow and replay drill
  - Consumers read broker in shadow and compare expected envelopes and ordering windows.
  - Run broker outage, CDC lag, WAL retention, duplicate delivery, and schema-rollout drills.

Stage 4: Selective cutover for derived planes
  - DuckDB export scheduler and pgvector embedding workers may move to broker-fed jobs.
  - SSE/live updates remain PostgreSQL outbox-backed unless separately admitted.

Stage 5: External integration fan-out
  - Publish curated CloudEvents-compatible envelopes to integration topics/sinks.
```

## Safety rules

- PostgreSQL outbox remains authoritative until a future ADR changes it.
- Broker offsets are delivery state, not business state.
- CDC lag must never block command commit.
- Derived-plane staleness must degrade UI/AI/reporting, not corrupt operations.
- Broker consumers must verify `event_id`, `idempotency_key`, `schema_version`, `tenant_id`, `data_classification`, and `permission_scope_hash` where applicable.
- Replay and retention gaps trigger rebuild/full-refresh, not partial best-effort repair.

## References

- Debezium Outbox Event Router: https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html
- PostgreSQL logical replication: https://www.postgresql.org/docs/current/logical-replication.html
- NATS JetStream model: https://docs.nats.io/using-nats/developer/develop_jetstream/model_deep_dive
- CloudEvents specification: https://cloudevents.io/


---

## v0.14 external integration note

External integration policies are canonical in `docs/data/external-integration-strategy-options.md` and `docs/data/external-integration-contract.md`. This document may reference those contracts but must not restate connector authority rules.
