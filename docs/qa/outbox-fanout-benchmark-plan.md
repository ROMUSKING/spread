---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP benchmark plan"
---

# Outbox Fan-out Benchmark Plan

## BENCH-OUTBOX-001: Internal dispatcher throughput

Measure outbox dispatch throughput and lag for 1k, 10k, and 100k events with mixed target planes. Blocks if p99 dispatch lag exceeds 10s for 10k events, duplicate business effect count is greater than zero, or command commit p95 regresses by more than 5ms.

## BENCH-OUTBOX-002: CDC shadow parity

Run polling dispatcher and CDC bridge in parallel over the same outbox window. Blocks on event count mismatch, `event_id`/`idempotency_key` mismatch, `payload_hash` mismatch, or partition-key ordering violation.

## BENCH-OUTBOX-003: Broker duplicate and outage behavior

Inject broker duplicate delivery, consumer restart, and broker outage. Blocks if business effect duplicates occur, command commit path blocks on broker outage, or consumer checkpoint cannot recover.

## BENCH-OUTBOX-004: Specialized-plane job freshness

Measure pgvector embedding invalidation, DuckDB export scheduling, and TigerBeetle repair/reconciliation notifications. Targets: semantic job lag p99 <= 120s, analytics job lag p99 <= 120s, ledger repair notification p99 <= 30s.

## BENCH-OUTBOX-005: Schema and payload evolution

Run old and new consumers during an event schema migration. Blocks if old consumers cannot ignore unknown fields, new consumers cannot read prior schema within compatibility window, or regulated data routes to unauthorized sink.

## BENCH-LIVE-OUTBOX-POLL-001: MVP polling reader regression guard

This benchmark protects P0-LIVE-001 from post-MVP envelope bloat.

Dataset:

```text
10k outbox_events in replay window
100 local SSE subscribers per instance
1k deliverable SSE events
9k non-local or non-SSE mixed target-plane events
10% payload_ref rows
mixed payload_size_bytes distribution up to 64 KiB inline target
retention cleanup running concurrently
one forced retention gap
```

Blocks if:

```text
p99 poll SQL > 250 ms
p99 poll cycle > 750 ms
payload fetch occurs before local demand filtering
Seq Scan appears on outbox_events in EXPLAIN
bytes fetched per poll exceeds 2 MiB without full-refresh fallback
retention gap causes partial replay instead of SYNC_REQUIRED
any duplicate user-visible delivery occurs
```

Required saved evidence:

```text
EXPLAIN (ANALYZE, BUFFERS) for envelope scan
EXPLAIN (ANALYZE, BUFFERS) for payload fetch
poller trace spans
payload byte histogram
retention cleanup timing
subscriber count and workbook demand distribution
```
