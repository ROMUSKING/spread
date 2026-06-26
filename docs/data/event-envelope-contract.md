---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "normative event contract"
---

# Event Envelope Contract

## Purpose

Define the durable outbox envelope that supports MVP polling/SSE and later CDC, broker, DuckDB, pgvector, TigerBeetle reconciliation, and external-integration consumers.

The envelope is **CloudEvents-compatible**, but MVP does not require CloudEvents serialization or any broker runtime.

## Normative rules

1. `outbox_id` is the PostgreSQL replay cursor and local ordering key.
2. `event_id` is the stable event identity used by deduplication and external transports.
3. `idempotency_key` is deterministic for the same logical event.
4. `route_key` determines consumer routing.
5. `partition_key` determines ordering affinity for broker topics/streams.
6. `payload_hash` detects same-ID/different-payload corruption.
7. `schema_version` and `data_schema` are required before external publication.
8. `tenant_id`, `visibility_scope`, and `data_classification` are required on every event.
9. `trace_id` and `correlation_id` propagate command-to-derived-plane lineage.
10. Large or regulated payloads use `payload_ref`; inline payloads remain small and redacted.

## Canonical event identity

```text
event_id = deterministic_uuid("outbox-event:v1", tenant_id, command_id, command_event_seq, event_type)
```

`outbox_id` must not be used as the external event identity because it is a local replay cursor.

`command_event_seq` is the per-command event sequence allocated inside the same PostgreSQL mutation transaction that writes terminal command status and outbox rows. It is nullable only for non-command-derived system events. Command-derived rows must satisfy `UNIQUE (tenant_id, command_id, command_event_seq)`.

## CloudEvents-compatible mapping

| Internal field | CloudEvents field | Notes |
|---|---|---|
| `event_id` | `id` | Unique with `event_source`. |
| `event_source` | `source` | Producer namespace. |
| `event_type` | `type` | Versioned semantic type. |
| `event_subject` | `subject` | Aggregate/object path. |
| `created_at` | `time` | Envelope creation time. |
| `payload_content_type` | `datacontenttype` | Usually `application/json`. |
| `data_schema` | `dataschema` | Versioned payload schema URI. |
| `payload` or `payload_ref` | `data` | Inline or referenced data. |

## MVP schema preparation

These fields belong in `outbox_events` now or before post-MVP fan-out:

```sql
outbox_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
event_id UUID NOT NULL UNIQUE,
idempotency_key TEXT NOT NULL UNIQUE,
event_type TEXT NOT NULL,
event_source TEXT NOT NULL,
event_subject TEXT NULL,
aggregate_type TEXT NULL,
aggregate_id UUID NULL,
route_key TEXT NOT NULL,
partition_key TEXT NOT NULL,
target_planes TEXT[] NOT NULL DEFAULT ARRAY['sse']::TEXT[],
schema_version INTEGER NOT NULL DEFAULT 1,
data_schema TEXT NOT NULL,
payload_content_type TEXT NOT NULL DEFAULT 'application/json',
payload JSONB NULL,
payload_ref TEXT NULL,
payload_hash TEXT NOT NULL,
payload_size_bytes INTEGER NOT NULL CHECK (payload_size_bytes >= 0),
tenant_id UUID NOT NULL,
workbook_id UUID NULL,
command_id UUID NULL,
command_event_seq INTEGER NULL,
visibility_scope TEXT NOT NULL,
data_classification TEXT NOT NULL,
permission_scope_hash TEXT NULL,
trace_id TEXT NOT NULL,
correlation_id TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

## Consumer checkpoint contract

Every durable consumer tracks `consumer_id`, `consumer_group`, `consumer_version`, tenant or tenant bucket, `last_outbox_id`, `last_event_id`, timestamps, and failure count.

## Idempotent consumer contract

Consumers deduplicate by `event_id` and `idempotency_key`. A duplicate event with the same hash is safe. A duplicate event ID with a different payload hash is a release-blocking corruption signal.

## Derived-plane routing

| Target plane | Required target plane value | Required checks |
|---|---|---|
| SSE/live | `sse` | tenant/workbook subscription and replay window. |
| pgvector | `semantic` | embedding eligibility, permission scope, data classification. |
| DuckDB | `analytics` | export policy, snapshot manifest, data classification. |
| TigerBeetle repair/reconciliation | `ledger` | ledger migration state, projection repair status. |
| External integration | `integration` | schema contract and customer/integration approval. |

## Required evidence

- `ci://tests/outbox/event-envelope-contract`
- `ci://tests/outbox/event-id-idempotency-key-stable`
- `ci://tests/outbox/payload-hash-conflict-detected`
- `ci://tests/outbox/consumer-checkpoint-idempotency`
- `ci://tests/outbox/regulated-payload-routing-blocked`


---

## v0.14 external integration note

External integration policies are canonical in `docs/data/external-integration-strategy-options.md` and `docs/data/external-integration-contract.md`. This document may reference those contracts but must not restate connector authority rules.
