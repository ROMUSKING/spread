# ADR-0015: Live Update Wake-Up - Polling First, NOTIFY Optional

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required for Phase 0  
**Supersedes:** v0.11 ADR-0015 wording

## Context

The durable event source is `outbox_events`. PostgreSQL `LISTEN/NOTIFY` can wake readers after commit, but it is not durable event transport and can fail a transaction at commit if its notification queue becomes full.

## Decision

Use polling-first durable outbox delivery for Phase 0. `LISTEN/NOTIFY` is optional and may be admitted only after benchmark evidence.

## Admission criteria

```text
p95(commit_with_notify - commit_without_notify) <= 50 ms
AND no sustained lock-wait amplification
AND notification queue usage remains below alert thresholds
AND polling fallback passes
```

## Consequences

- Live updates may arrive with modest polling delay during Phase 0.
- Commit latency is protected.
- Durable delivery remains independent of notification delivery.
- Payloads in notifications, if enabled, must contain only keys or high-watermark hints.

## Acceptance

`BENCH-NOTIFY-001` must pass before enabling `NOTIFY` in pilot.
