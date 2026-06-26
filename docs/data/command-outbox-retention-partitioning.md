---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
---

# Command and Outbox Retention, Partitioning, and Vacuum

## Purpose

Centralize data-retention and scale rules for `command_log`, `audit_events`, `domain_events`, `outbox_events`, and heartbeat/counter tables.

## Command log recommendation

Do **not** range-partition `command_log` by `created_at` in Phase 0. That weakens or complicates the tenant-scoped uniqueness guarantee unless `created_at` is added to every unique constraint. The command identity contract is more important than retention convenience.

| Scale stage | Recommended design | Reason |
|---|---|---|
| Phase 0 and first pilot | Single `command_log` table with `PRIMARY KEY (tenant_id, command_id)` and TTL cleanup. | Simplest way to preserve idempotency. |
| Multi-tenant scale path | Hash partition by `tenant_id` with `PRIMARY KEY (tenant_id, command_id)`. | PostgreSQL partitioned unique constraints include the partition key, so tenant-hash partitioning preserves uniqueness. |
| Long retention archive | Optional `command_log_archive` partitioned by time, fed after terminal status. | Separates idempotency lookup from compliance/history storage. |

### Command log schema

```sql
CREATE TABLE command_log (
  tenant_id UUID NOT NULL,
  command_id UUID NOT NULL,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  workbook_id UUID NULL,
  command_type TEXT NOT NULL,
  command_status TEXT NOT NULL CHECK (
    command_status IN ('received','committed','rejected','failed','ambiguous')
  ),
  request_hash TEXT NOT NULL,
  request_body_hash TEXT NOT NULL,
  response_body_redacted JSONB NULL,
  response_ref TEXT NULL,
  response_body_redacted_hash TEXT NULL,
  client_ip INET NULL,
  committed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, command_id)
);

CREATE INDEX idx_command_log_expires_at
  ON command_log (expires_at);

CREATE INDEX idx_command_log_user_recent
  ON command_log (tenant_id, user_id, created_at DESC);

CREATE INDEX idx_command_log_trace
  ON command_log (trace_id);
```

### Optional tenant-hash partitioning

```sql
CREATE TABLE command_log_partitioned (
  LIKE command_log INCLUDING ALL,
  PRIMARY KEY (tenant_id, command_id)
) PARTITION BY HASH (tenant_id);
```

Create 16 or 32 partitions initially only after benchmark evidence shows the single table is a bottleneck. Do not add `created_at` to the command primary key.

## Outbox events recommendation

`outbox_events` is append-heavy and replay-oriented. The Phase 0 default is a single table with covering indexes. The scale path is range partitioning by `outbox_id`, not by `created_at`, so `outbox_id` remains the replay key and can remain uniquely constrained by partition key.

### Outbox events schema

The MVP schema is intentionally broker/CDC-ready but does not require a broker. `outbox_id` is the PostgreSQL replay cursor. `event_id` is the stable event identity for deduplication and future transports. `command_event_seq` is the per-command event sequence used to derive deterministic event identity when an outbox event is emitted from a command transaction.

```sql
CREATE TABLE outbox_events (
  outbox_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  workbook_id UUID NULL,
  command_id UUID NULL,
  command_event_seq INTEGER NULL CHECK (command_event_seq IS NULL OR command_event_seq > 0),
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
  visibility_scope TEXT NOT NULL DEFAULT 'tenant',
  data_classification TEXT NOT NULL DEFAULT 'internal',
  permission_scope_hash TEXT NULL,
  trace_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (payload IS NOT NULL OR payload_ref IS NOT NULL)
);

CREATE INDEX idx_outbox_events_poll_cover
  ON outbox_events (outbox_id)
  INCLUDE (
    event_id, tenant_id, workbook_id, event_type, schema_version,
    target_planes, data_classification, permission_scope_hash,
    payload_size_bytes, payload_hash, created_at, trace_id, route_key
  );

CREATE INDEX idx_outbox_events_tenant_poll
  ON outbox_events (tenant_id, outbox_id)
  INCLUDE (event_id, workbook_id, event_type, schema_version, target_planes, payload_size_bytes, payload_hash, created_at);

CREATE INDEX idx_outbox_events_tenant_workbook_poll_cover
  ON outbox_events (tenant_id, workbook_id, outbox_id)
  INCLUDE (
    event_id, event_type, schema_version, target_planes,
    data_classification, permission_scope_hash, payload_size_bytes,
    payload_hash, created_at, trace_id, route_key
  );

CREATE UNIQUE INDEX ux_outbox_events_command_seq
  ON outbox_events (tenant_id, command_id, command_event_seq)
  WHERE command_id IS NOT NULL AND command_event_seq IS NOT NULL;

CREATE INDEX idx_outbox_events_route_poll ON outbox_events (route_key, outbox_id);
CREATE INDEX idx_outbox_events_target_planes ON outbox_events USING GIN (target_planes);
CREATE INDEX idx_outbox_events_created_at ON outbox_events (created_at);
```

### Outbox consumer checkpoints

```sql
CREATE TABLE outbox_consumer_checkpoints (
  consumer_id TEXT NOT NULL,
  consumer_group TEXT NOT NULL,
  consumer_version TEXT NOT NULL,
  tenant_id UUID NULL,
  tenant_bucket INTEGER NULL,
  last_outbox_id BIGINT NOT NULL DEFAULT 0,
  last_event_id UUID NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_error_at TIMESTAMPTZ NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_id, consumer_group, consumer_version, tenant_id, tenant_bucket)
);

CREATE INDEX idx_outbox_consumer_checkpoints_lag ON outbox_consumer_checkpoints (consumer_group, last_outbox_id);
```

### Outbox dispatch attempts

```sql
CREATE TABLE outbox_dispatch_attempts (
  event_id UUID NOT NULL,
  consumer_group TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  dispatch_status TEXT NOT NULL CHECK (dispatch_status IN ('claimed','published','acked','failed','dead_lettered')),
  effect_hash TEXT NULL,
  error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, consumer_group, attempt_no)
);

CREATE INDEX idx_outbox_dispatch_attempts_status ON outbox_dispatch_attempts (consumer_group, dispatch_status, created_at);
```

### Event schema registry

```sql
CREATE TABLE event_schema_registry (
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  data_schema TEXT NOT NULL,
  compatibility_window_until TIMESTAMPTZ NULL,
  deprecated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_type, schema_version)
);
```

### Post-MVP fan-out preparedness

`outbox_events` is the shared event-envelope source for SSE, pgvector embedding invalidation, DuckDB export scheduling, TigerBeetle projection repair/reconciliation, and external integrations. Post-MVP brokers or CDC bridges must consume this table; they must not infer business events from arbitrary operational table changes.

### Polling performance contract

MVP polling-reader performance is governed by `docs/data/outbox-polling-performance-contract.md`. The richer event envelope must not regress `BENCH-LIVE-001`. Envelope scans must use covering indexes and payloads must be fetched only after local demand filtering.



## Operational support tables

This file is also the canonical DDL source for Phase 0 heartbeat and transient rate-limit observation tables. Runtime docs may describe behavior but must not duplicate these `CREATE TABLE` definitions.

### Application instance heartbeats

```sql
CREATE TABLE app_instance_heartbeats (
  instance_id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sse_connection_count INTEGER NOT NULL DEFAULT 0 CHECK (sse_connection_count >= 0),
  command_inflight_count INTEGER NOT NULL DEFAULT 0 CHECK (command_inflight_count >= 0)
);

CREATE INDEX idx_app_instance_heartbeats_last_seen
  ON app_instance_heartbeats (last_seen_at);
```

### Coarse PostgreSQL rate-limit observations

```sql
CREATE TABLE rate_limit_minute_observations (
  tenant_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  risk_class TEXT NOT NULL,
  command_type TEXT NOT NULL,
  observed_count INTEGER NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
  PRIMARY KEY (tenant_id, window_start, risk_class, command_type)
);

CREATE INDEX idx_rate_limit_minute_observations_window
  ON rate_limit_minute_observations (window_start, tenant_id);
```

### Cleanup

```sql
DELETE FROM app_instance_heartbeats
WHERE last_seen_at < now() - INTERVAL '10 minutes';
```

Heartbeat cleanup must run under a scheduled single-writer job or advisory lock.

## Retention rules

| Topic | Rule |
|---|---|
| Command pilot retention | 7 days target for idempotency lookup. |
| Command production retention | 30 days target unless compliance/legal changes it. |
| Raw request body | Not stored by default. Store `request_body_hash` only; raw request bodies are not retained by default. |
| Response storage | Store redacted response or encrypted short-retention `response_ref`. |
| Ambiguity | TTL cleanup may set `ambiguous` only after expiry and no matching audit/domain/outbox evidence exists. |
| Outbox replay retention | Must exceed maximum supported reconnect window. |
| Retention gap | Must force full refresh, not partial best-effort replay. |
| Audit independence | Audit retention must not depend on outbox retention. |
| Legal hold | Must block hard-delete, partition drop, and encrypted response reference purge. |

## Heartbeats and transient counters

- Heartbeat cleanup deletes stale rows older than 10 minutes.
- Cleanup uses advisory lock or equivalent single-writer scheduling.
- Heartbeat-derived active counts are eventually consistent; rate budgets must include conservative headroom.
- Unlogged tables may be used only for transient non-authoritative counters where crash reset is acceptable.
- Transient counters are not audit, billing, security evidence, or compliance records.

## Required evidence

- `ci://tests/data/outbox-schema-contract`
- `ci://tests/rate-limit/heartbeat-cleanup`
- `ci://benchmarks/BENCH-LIVE-001`
- `ci://tests/live-update/full-refresh-fallback`
- `dashboard://outbox-retention-vacuum`
