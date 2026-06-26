---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "implementation-readiness baseline"
---

# Chaos Test Plan

## Purpose

Prove command recovery, outbox replay, and numeric-ledger repair paths under realistic partial-failure conditions.

## Required tests

| ID | Scenario | Expected result |
|---|---|---|
| `ci://tests/chaos/command-db-connection-kill-mid-transaction` | Kill DB connection during command transaction before commit. | Command resolves rejected/failed; no partial audit/domain/outbox state. |
| `ci://tests/chaos/command-network-loss-after-commit` | Drop HTTP response after successful commit. | Command status recovers committed outcome; no blind retry. |
| `ci://tests/chaos/outbox-retention-gap-full-refresh` | Force client watermark behind retention. | `SYNC_REQUIRED` and full refresh, no partial replay. |
| `ci://tests/chaos/outbox-bloat-high-churn-retention-gap` | Generate 10k mixed-plane envelopes, 100 SSE subscribers, concurrent retention cleanup, and one forced retention gap. | Poller keeps p99 budget, skips non-local payloads, emits `SYNC_REQUIRED` for the gap, and no duplicate delivery occurs. |
| `ci://tests/chaos/command-network-partition-after-ledger-success` | Simulate post-cutover TigerBeetle success then PostgreSQL projection failure. | Recovery repairs projection/outbox/command terminal status from deterministic transfer IDs. |
| `ci://tests/chaos/shadow-worker-retry-after-timeout` | Timeout posting shadow transfer. | Retry same transfer ID; `exists` with same payload is success. |
| `ci://tests/chaos/reconciliation-mismatch-pages` | Inject PostgreSQL/TigerBeetle mismatch. | Cutover is blocked and page/ticket emitted by severity. |
| `ci://tests/chaos/mixed-plane-failure-cascade` | Combine outbox lag, stale pgvector chunk, DuckDB snapshot delay, and TigerBeetle shadow mismatch. | Operational edits continue; user-visible AI/analytics answers are blocked, marked stale, or cite deterministic records only after revalidation. |

## Evidence requirements

- Raw failure-injection logs.
- Command IDs and trace IDs for every injected failure.
- Before/after rows for command, audit, domain, outbox, and ledger projection tables.
- Reconciliation report when ledger tests are involved.

## v0.13.2 mixed-plane assertions

Every chaos run involving pgvector, DuckDB, TigerBeetle, or fan-out must assert:

```text
- command commits do not depend on broker/CDC/AI/analytics availability;
- RetrievalRevalidator filters stale or unauthorized derived-plane candidates;
- DuckDB artifacts with stale high-watermarks are not presented as authoritative;
- TigerBeetle shadow mismatches block cutover and customer-visible ledger analytics;
- outbox retention gaps produce full refresh or backfill, never silent partial replay;
- trace_id and correlation_id connect command, outbox, derived-plane job, and user-visible response.
```
