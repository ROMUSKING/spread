---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP migration plan"
---

# Post-MVP Outbox Fan-out Transition Plan

## Principle

Adopt outbox fan-out in layers. Do not replace the PostgreSQL outbox; extend it.

## Stages

```text
0. MVP-ready envelope: add event fields, consumer checkpoints, and schema registry; no broker runtime.
1. Internal dispatcher: dispatch derived-plane jobs from PostgreSQL outbox.
2. CDC shadow: tail only outbox_events and publish to a shadow broker stream.
3. Strict shadow: selected consumers compare broker output against dispatcher output.
4. Selective cutover: enable non-critical telemetry, DuckDB export, pgvector embedding invalidation, TigerBeetle repair notices, external integrations, then optionally live fan-out.
```

## Rollback

```text
pause broker/CDC consumers
resume PostgreSQL dispatcher/polling consumers
rewind consumer checkpoint to last validated outbox_id
replay idempotently
```

Do not roll back by deleting events.
