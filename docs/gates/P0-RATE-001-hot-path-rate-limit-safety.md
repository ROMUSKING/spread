# Gate: P0-RATE-001 - Hot-Path Rate-Limit Safety

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Owner:** Platform/API Owner  
**Priority:** P0  
**Waiver allowed:** No for ordinary edit endpoints  
**Normative spec:** v0.17.0 sections 8 and 12.5  
**SLO reference:** `docs/slo-baseline.yml`

## Requirement

Ordinary low-risk edit commands must not perform synchronous PostgreSQL rate-limit counter writes before business execution.

## Required behavior

- Use edge and per-instance in-memory token buckets on the ordinary edit hot path.
- Divide tenant budgets by active instance count plus headroom.
- Clean stale heartbeats with a scheduled job; active count is eventually consistent.
- Use PostgreSQL only for high-risk command ceilings or asynchronous coarse reconciliation.
- Emit `429`, `Retry-After`, `RateLimit`, and `RateLimit-Policy` on throttled requests.
- Track reconciliation lag, instance heartbeat freshness, limiter overhead, and outer abuse-control decisions.
- Credential-stuffing, token spray, and DDoS controls must run before the ordinary edit path.

## Evidence required

- `ci://tests/rate-limit/local-token-bucket`
- `ci://tests/rate-limit/cross-instance-budget-division`
- `ci://tests/rate-limit/no-pg-counter-write-on-edit-hot-path`
- `ci://benchmarks/BENCH-RATE-001`
- `ci://tests/rate-limit/credential-stuffing-throttled-before-edit-path`
- `ci://tests/rate-limit/high-risk-command-postgres-ceiling`
- `dashboard://rate-limit-reconciliation-lag`

## Failure behavior

Block release if ordinary edits write PostgreSQL counters synchronously or limiter overhead exceeds SLO.


## v0.17.0 active baseline note

This P0 gate is active under the v0.17.0 AI coding-agent implementation-roadmap baseline.
