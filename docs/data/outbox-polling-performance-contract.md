---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "normative P0 live-update performance contract"
owner: "Platform/SRE Owner"
---

# Outbox Polling Performance Contract

## Purpose

Protect the MVP polling reader from envelope bloat, high-watermark drift, retention gaps, and post-MVP fan-out fields. The richer outbox envelope must not regress the P0 polling/SSE path.

## Non-negotiable rule

`outbox_events` is the durable replay source. Polling readers must select small envelopes first and fetch payloads only after local demand is known.

```text
poll envelope metadata -> filter by local demand -> fetch payloads -> deliver SSE -> advance local high watermark
```

Never fetch full payloads just to discover that no local subscriber needs them.

## Performance budgets

These budgets extend `BENCH-LIVE-001` and block P0-LIVE-001 if missed without owner waiver.

| Scenario | Required target | Notes |
|---|---:|---|
| 10k-event envelope scan, 100 local SSE subscribers | p99 poll SQL <= 250 ms | Warm cache target on pilot dataset. |
| 10k-event poll cycle including local demand filter | p99 <= 750 ms | Excludes network send time to slow clients. |
| Payload fetch for deliverable events | p99 <= 500 ms or full-refresh fallback | Uses `payload_ref` for large payloads. |
| End-to-end replay lag | p99 <= 8 s | Existing polling SLO. |
| Event envelope metadata row | target <= 2 KiB, hard alert > 4 KiB | Avoids fan-out envelope bloat. |
| Inline payload | target <= 64 KiB | Larger payloads use `payload_ref`. |
| Bytes fetched per poll | <= 2 MiB before full-refresh decision | Prevents one poll from monopolizing the process. |
| Sequential scan on `outbox_events` | prohibited on pilot-like dataset | Query plan failure blocks gate. |

## Demand-filter query pattern

### Step 1: scan envelope metadata only

```sql
SELECT
  outbox_id,
  event_id,
  tenant_id,
  workbook_id,
  event_type,
  schema_version,
  target_planes,
  data_classification,
  permission_scope_hash,
  payload_size_bytes,
  payload_hash,
  created_at
FROM outbox_events
WHERE outbox_id > $1
  AND tenant_id = ANY($2::uuid[])
ORDER BY outbox_id ASC
LIMIT $3;
```

### Step 2: filter locally

The application filters by:

```text
tenant_id
workbook_id
target_planes contains 'sse'
local SSE connection demand
schema compatibility
payload_size_bytes budget
```

### Step 3: fetch payloads only for deliverable IDs

```sql
SELECT outbox_id, event_id, payload, payload_ref, payload_hash
FROM outbox_events
WHERE outbox_id = ANY($1::bigint[])
ORDER BY outbox_id ASC;
```

## EXPLAIN expectations

For `BENCH-LIVE-001`, saved `EXPLAIN (ANALYZE, BUFFERS)` plans must show:

```text
- no Seq Scan on outbox_events;
- envelope scan uses idx_outbox_events_tenant_poll or idx_outbox_events_poll_cover;
- workbook-scoped fetch uses idx_outbox_events_tenant_workbook_poll_cover when workbook_id is available;
- rows examined should be proportional to the replay window, not table size;
- heap blocks fetched are low for envelope-only scans after visibility map warms;
- sort memory is bounded by LIMIT and no external disk sort appears;
- query remains stable with target_planes and data_classification columns present.
```

If the planner chooses a sequential scan on a pilot-like dataset, the fix is index/statistics/query-shape work, not increasing the SLO.

## Covering indexes

Canonical DDL lives in `docs/data/command-outbox-retention-partitioning.md`. It must include covering indexes equivalent to:

```sql
CREATE INDEX idx_outbox_events_poll_cover
  ON outbox_events (outbox_id)
  INCLUDE (
    event_id, tenant_id, workbook_id, event_type, schema_version,
    target_planes, data_classification, permission_scope_hash,
    payload_size_bytes, payload_hash, created_at, trace_id, route_key
  );

CREATE INDEX idx_outbox_events_tenant_workbook_poll_cover
  ON outbox_events (tenant_id, workbook_id, outbox_id)
  INCLUDE (
    event_id, event_type, schema_version, target_planes,
    data_classification, permission_scope_hash, payload_size_bytes,
    payload_hash, created_at, trace_id, route_key
  );
```

## High-watermark and retention-gap behavior

| Case | Required behavior |
|---|---|
| Normal gap in `outbox_id` sequence | Continue. `outbox_id` is monotonic, not gapless. |
| Client watermark older than retained outbox window | Return `SYNC_REQUIRED`; do not attempt partial replay. |
| Reader local high-watermark is ahead of a new subscriber | New subscriber gets snapshot + replay handshake before being considered caught up. |
| Payload budget exceeded | Send schema-compatible full-refresh hint for affected workbook/tenant. |
| Event schema mismatch | Full refresh or compatibility adapter; no best-effort partial delivery. |
| Payload hash mismatch | Block delivery, page SRE/Security, do not advance subscriber state. |

## Outbox bloat and churn scenario

`BENCH-LIVE-001` and `BENCH-OUTBOX-001` must include a high-churn scenario:

```text
- 100 active SSE subscribers per instance;
- 10k envelope scan window;
- 1k deliverable workbook events;
- 9k non-local or non-SSE events;
- mixed target_planes including sse, ai, analytics, ledger_repair, integration;
- 10% payload_ref rows;
- retention cleanup running concurrently;
- one simulated retention gap causing SYNC_REQUIRED.
```

Blocks if duplicate delivery, missed delivery, silent partial replay, or p99 poll time regression occurs.

## Observability

Required metrics:

```text
erp_outbox_poll_sql_seconds
erp_outbox_poll_cycle_seconds
erp_outbox_envelope_rows_scanned_total
erp_outbox_payload_bytes_fetched_total
erp_outbox_full_refresh_required_total
erp_outbox_retention_gap_total
erp_outbox_payload_ref_ratio
erp_outbox_seq_scan_detected_total
```

Alerts:

```text
p99(erp_outbox_poll_cycle_seconds) > 0.75s for 10m
p99(erp_outbox_poll_lag_seconds) > 8s for 10m
erp_outbox_seq_scan_detected_total > 0 in staging gate run
erp_outbox_retention_gap_total > expected reconnect-window baseline
```
