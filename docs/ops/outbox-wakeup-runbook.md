# Runbook: Outbox Wake-Up and Live Update Delivery

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Normal mode

Phase 0 normal mode is `polling`.

1. Confirm `liveUpdateWakeupMode=polling`.
2. Check `erp_outbox_poll_lag_seconds` against p99 SLO.
3. Check active SSE connection count and instance distribution.
4. Check full-refresh count and reasons.
5. Confirm outbox reader high watermark advances.
6. Confirm payload fetch is skipped when no local subscribers exist.

## If polling lag breaches SLO

1. Check database pressure and `outbox_events` query plan.
2. Verify required indexes exist.
3. Confirm no retention gap is forcing repeated full refreshes.
4. Reduce poll interval only if database load allows it.
5. Add reader capacity or isolate hot tenants if instance-local queues saturate.

## NOTIFY admission

Only enable `notify` after `BENCH-NOTIFY-001` passes and P0-LIVE-001 is signed.

## Fallback from NOTIFY

If commit latency, lock waits, or notification queue usage increase after enabling `notify`:

1. Set `liveUpdateWakeupMode=auto_polling` or `polling`.
2. Verify outbox polling resumes.
3. Confirm no event loss by replaying from last known high watermark.
4. Open incident ticket with benchmark and dashboard links.

## Wake-up coalescing and fan-out optimization

Polling remains the durable mechanism. Under high tenant density, reduce thundering-herd behavior without changing durability:

1. Apply per-instance poll jitter of 10%-30%.
2. Coalesce local wake-ups for the same tenant/workbook into one read cycle.
3. Keep a local subscription index by tenant and workbook.
4. Query only tenant IDs with local subscribers.
5. Fetch payloads only for locally subscribed workbooks.
6. Batch SSE fan-out per workbook and avoid one database query per connection.
7. If a tenant is hot, temporarily shorten that tenant's poll interval only on instances with subscribers.
8. If a tenant has no local subscribers, advance only metadata/high-watermark state as allowed by the subscription-handshake contract.

Stress evidence must include at least 100 concurrent SSE subscribers per application instance:

```text
ci://benchmarks/BENCH-LIVE-001-100-sse-subscribers
ci://tests/live-update/wakeup-coalescing-no-duplicate-delivery
```


## v0.13.2 post-MVP fan-out note

MVP behavior remains polling-first. Post-MVP fan-out, CDC, broker, and external event-bus adoption is governed by `docs/data/outbox-integration-strategy-options.md`, `docs/data/event-envelope-contract.md`, and `P1-OUTBOX-001`. Do not publish directly to a broker from command handlers.
