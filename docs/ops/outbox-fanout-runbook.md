---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP runbook"
---

# Outbox Fan-out Runbook

## Purpose

Operate post-MVP outbox dispatchers, CDC bridges, broker topics/streams, and derived-plane consumers without compromising command commits or PostgreSQL outbox durability.

## Triage order

1. Confirm command commits are healthy.
2. Check PostgreSQL outbox insert rate and oldest retained outbox row.
3. Check polling/SSE delivery lag.
4. Check internal dispatcher lag by consumer group.
5. Check CDC bridge lag and replication slot/WAL retention if enabled.
6. Check broker topic/stream lag, duplicate rate, and consumer errors.
7. Check derived-plane freshness for pgvector, DuckDB, and TigerBeetle projection repair.

## Safe degradation

| Failure | Allowed degradation |
|---|---|
| Broker outage | Continue command commits and PostgreSQL outbox polling; pause broker-fed derived jobs. |
| CDC lag | Fall back to application dispatcher or polling consumers. |
| Derived-plane consumer failure | Mark plane stale and hide/label stale AI/analytics features. |
| SSE replay retention gap | Force workbook full refresh. |
| Schema rollout bug | Disable new event version and continue old consumer compatibility window. |

## Prohibited actions

- Do not delete outbox rows to clear lag.
- Do not advance consumer checkpoints manually without recorded owner approval.
- Do not route regulated payloads to a new sink without compliance sign-off.
- Do not make command handlers publish directly to a broker to bypass outbox lag.
