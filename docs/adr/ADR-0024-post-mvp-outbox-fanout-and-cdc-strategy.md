---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "accepted"
---

# ADR-0024: Post-MVP Outbox Fan-out and CDC Strategy

## Context

Phase 0 uses a PostgreSQL transactional outbox with polling-first delivery. v0.13 also introduces planned specialized planes: TigerBeetle for conserved numeric movement, pgvector for semantic retrieval, and DuckDB for analytics. These planes need reliable invalidation, replay, and job scheduling without adding broker risk to MVP.

## Decision

Keep PostgreSQL `outbox_events` as the authoritative delivery log for MVP and post-MVP. Prepare the MVP schema with a CloudEvents-compatible envelope. After MVP, admit fan-out layers only through `P1-OUTBOX-001` evidence.

The selected sequence is:

```text
MVP polling-first outbox
  -> internal outbox dispatcher
  -> CDC shadow bridge
  -> selective broker cutover for derived-plane jobs/integrations
```

## Accepted technologies to evaluate

| Technology/path | Status |
|---|---|
| PostgreSQL polling | MVP default and permanent fallback. |
| PostgreSQL `LISTEN/NOTIFY` | Wake-up hint only after P0-LIVE evidence. |
| Application outbox dispatcher | First post-MVP fan-out step. |
| Debezium Outbox Event Router to Kafka/Redpanda | Preferred broker bridge candidate after integration pressure exists. |
| NATS JetStream | Candidate for lightweight internal job fan-out. |
| Managed cloud event buses | Integration sinks only, not internal authority. |
| Direct broker write from command handlers | Rejected. |
| Event stream as operational source of truth | Rejected for this roadmap. |

## Guardrails

- No external transport may mutate ERP state directly.
- Any external event proposing a mutation must create a command.
- Broker offsets, CDC LSNs, and delivery acknowledgements are delivery state only.
- Large/regulated data must use `payload_ref` and classification gates.
- Derived-plane jobs must record source `outbox_id` high watermark and source schema version.
