# Gate: P0-LIVE-001 - Polling-First Outbox Live Updates

**Version:** 0.16.1  
**Last-reviewed:** 2026-06-26  
**Owner:** Platform/SRE Owner  
**Priority:** P0  
**Waiver allowed:** No  
**Normative spec:** v0.16.1 sections 5 and 12.2  
**SLO reference:** `docs/slo-baseline.yml`

## Requirement

Live updates must be delivered from durable `outbox_events` without depending on PostgreSQL `LISTEN/NOTIFY`.

## Required behavior

- Phase 0 default `liveUpdateWakeupMode` is `polling`.
- Outbox reader scans by monotonic `outbox_id > local_high_watermark`.
- `outbox_id` is monotonic but not gapless; gaps are normal.
- Poller applies jitter and local-subscriber filtering before payload fetch.
- Outbox schema follows `docs/data/command-outbox-retention-partitioning.md`.
- Recommended indexes exist for high-watermark and tenant/workbook filtered polling.
- Outbox polling performance follows `docs/data/outbox-polling-performance-contract.md`.
- Envelope metadata scans and payload fetches are separated.
- 10k-event / 100-subscriber EXPLAIN evidence shows no sequential scan on `outbox_events`.
- Retention and full-refresh fallback are documented and tested.
- `NOTIFY` may be enabled only after commit-latency benchmark passes.
- `NOTIFY` payloads contain only keys or high-watermark hints.

## Evidence required

- `ci://tests/live-update/outbox-polling-replay`
- `ci://tests/live-update/full-refresh-fallback`
- `ci://tests/live-update/outbox-retention-gap-refresh`
- `ci://tests/live-update/outbox-demand-filter-payload-fetch-minimized`
- `ci://tests/live-update/outbox-explain-no-seq-scan`
- `ci://tests/chaos/outbox-bloat-high-churn-retention-gap`
- `ci://benchmarks/BENCH-LIVE-001`
- `ci://benchmarks/BENCH-NOTIFY-001`
- `dashboard://outbox-polling-lag`
- `repo://docs/data/command-outbox-retention-partitioning.md`
- `repo://docs/data/outbox-polling-performance-contract.md`

## Failure behavior

Keep `NOTIFY` disabled and use polling if benchmark evidence is missing or unsafe.


## v0.16.1 active baseline note

This P0 gate is active under the v0.16.1 AI coding-agent implementation-roadmap baseline.
