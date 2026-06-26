# Outbox Polling Reader

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Purpose

Define durable polling-first live-update delivery.

## Normative behavior

The reader polls `outbox_events` by monotonic high watermark, filters by local subscribers before payload fetch, delivers SSE envelopes, and triggers full refresh on retention gaps, byte budget overflow, schema mismatch, or replay gaps.

## API/schema examples

Primary query: `SELECT outbox_id, tenant_id, workbook_id, event_type, payload_size_bytes, created_at FROM outbox_events WHERE outbox_id > $1 AND tenant_id = ANY($2::uuid[]) ORDER BY outbox_id ASC LIMIT $3`.

## Failure modes

If polling lag exceeds SLO, reduce interval, scale readers, or trigger full refresh. If NOTIFY is unsafe, disable it and continue polling.

## Required tests

- `ci://tests/live-update/outbox-polling-replay`
- `ci://tests/live-update/full-refresh-fallback`
- `ci://benchmarks/BENCH-LIVE-001`

## Observability fields

- `trace_id`
- `correlation_id`
- `tenant_id`
- `workbook_id`
- `outbox_id`
- `local_high_watermark`

## Owner role

Platform/SRE Owner

## Links

- `docs/gates/P0-LIVE-001-polling-first-outbox-live-updates.md`
- `docs/adr/ADR-0015-live-update-wakeup-polling-first-notify-optional.md`
- `docs/ops/outbox-wakeup-runbook.md`

## Wake-up coalescing implementation note

The reader should run one tenant/workbook-aware polling loop per application instance, not one polling loop per SSE connection.

Recommended in-memory structures:

```ts
type LocalDemandIndex = {
  tenants: Set<string>;
  workbookIdsByTenant: Map<string, Set<string>>;
  connectionIdsByWorkbook: Map<string, Set<string>>;
  pendingWakeupsByTenant: Map<string, number>;
};
```

Rules:

- Multiple connection wake-ups for the same tenant/workbook coalesce into a single poll.
- Payload fetch is skipped when no local workbook subscriber exists.
- Coalescing must not advance a newly connected client's state until the SSE initial snapshot/replay handshake completes.
- BENCH-LIVE-001 must include 100+ concurrent SSE subscribers per instance and verify no duplicate delivery, no missing replay, and acceptable p99 lag.


## v0.13.2 post-MVP fan-out note

MVP behavior remains polling-first. Post-MVP fan-out, CDC, broker, and external event-bus adoption is governed by `docs/data/outbox-integration-strategy-options.md`, `docs/data/event-envelope-contract.md`, and `P1-OUTBOX-001`. Do not publish directly to a broker from command handlers.

## v0.13.2 polling performance hardening

The polling reader must satisfy `docs/data/outbox-polling-performance-contract.md` before P0-LIVE-001 can pass.

Additional implementation rules:

- Use a two-stage query: envelope metadata first, payload fetch second.
- Do not fetch `payload` or `payload_ref` until local demand filtering decides the event is deliverable.
- Treat `target_planes`, `data_classification`, and post-MVP fan-out envelope fields as metadata, not a reason to fetch full payloads.
- Save `EXPLAIN (ANALYZE, BUFFERS)` plans for the 10k-event / 100-subscriber benchmark.
- Block release on sequential scan over `outbox_events` in pilot-like datasets.
- Return `SYNC_REQUIRED` on retention gaps or byte-budget overflow; do not attempt partial best-effort replay.

Additional evidence:

```text
ci://tests/live-update/outbox-demand-filter-payload-fetch-minimized
ci://tests/live-update/outbox-payload-budget-full-refresh
ci://tests/live-update/outbox-payload-hash-mismatch-blocks-delivery
ci://tests/live-update/outbox-explain-no-seq-scan
ci://tests/chaos/outbox-bloat-high-churn-retention-gap
ci://benchmarks/BENCH-LIVE-OUTBOX-POLL-001
```
