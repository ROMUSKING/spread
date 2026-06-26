---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "supporting rationale"
owner: "SRE Owner"
---

# SLO Target Rationale

## Purpose

Explain why baseline targets exist and where they may move after pilot evidence. `docs/slo-baseline.yml` remains the machine-readable source.

## Phase 0 target ranges

| Target | Baseline | Rationale | Revisit trigger |
|---|---:|---|---|
| Edit command p95 | 180 ms | Keeps one-cell edits feeling interactive while including command/audit/domain/outbox writes. | Real pilot p95 is consistently < 90 ms or > 220 ms. |
| Edit command p99 | 350 ms | Allows tail latency without hiding persistent commit-path contention. | Tail exceeds 500 ms under ordinary edits. |
| Command status lookup p95 | 60 ms | Recovery UX should feel immediate after network loss. | Query plan or retention growth changes lookup cost. |
| Polling lag p99 | 8 s | Conservative polling-first live updates; reliable beats instant in MVP. | Users need faster collaborative feel and polling query budget is proven. |
| 10k replay p95 | 10 s | Accepts large catch-up windows but blocks replay paths that cannot recover clients. | Workbook/event sizes exceed pilot assumptions. |
| Outbox poll SQL p99 | 250 ms | Prevents richer envelopes from competing with edit traffic. | Envelope bloat, table growth, or subscriber count changes. |
| Rate limiter overhead p95 | 5 ms | Hot-path limiter should be effectively invisible to edits. | Abuse controls move closer to request path. |
| Batch 10k validation | 400 ms | 10k paste should be bounded before productizing transactional batch. | Real user paste patterns differ materially. |
| Ledger strict-shadow overhead p95 | 100 ms | Shadow mode may add work but must not quietly consume edit latency budget. | P1-LEDGER workload proves lower/higher steady-state cost. |
| AI retrieval p95 | 250 ms | Post-MVP assistant search should feel responsive but remains read-side only. | Dedicated semantic DB evidence changes profile. |
| DuckDB 1m query p95 | 8 s | Analytics can be slower than edit path but must remain interactive for support/reporting. | Snapshot size or user-facing report needs change. |

## Dataset assumptions

All SLOs are invalid without recording:

```text
tenant count
workbook count
row count per workbook
event count per workbook
active SSE subscribers
concurrent editors
payload size distribution
ledger account/transfer cardinality
permission-scope cardinality
hardware/PostgreSQL/Node versions
git SHA
```

Benchmarks without dataset metadata are not admissible gate evidence.
