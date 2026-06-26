# Phase 0 Benchmark Plan

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**SLO reference:** `docs/slo-baseline.yml`

## Required benchmark IDs

| ID | Scenario | Target | Blocks |
|---|---|---:|---|
| BENCH-CMD-001 | Single edit command with command/audit/domain/outbox writes | p95 <= 180 ms | Phase 0 mutation path |
| BENCH-LIVE-001 | Outbox polling replay with active SSE subscribers | p99 lag <= 8 s | Live updates |
| BENCH-NOTIFY-001 | Commit latency with/without NOTIFY | delta p95 <= 50 ms | NOTIFY admission only |
| BENCH-RATE-001 | Local token bucket under concurrent edits | overhead p95 <= 5 ms | Rate limiter |
| BENCH-BATCH-001 | Partition validation at 100/1k/10k rows | 10k <= 400 ms | transactional_batch |
| BENCH-FORM-001 | Formula worker warm/cold/rebuild | warm delta <= 30 ms | Formula rollout |
| BENCH-RLS-001 | Permission/RLS plans by user-set cardinality | p95 <= 120 ms | Permission performance |

## Execution rules

- Use a versioned pilot-like dataset.
- Run five iterations; report median, p95, and p99.
- Record machine type, PostgreSQL version, Node.js version, OS, git SHA, and dataset version.
- Save raw logs and generated reports under `repo://benchmark-results/phase0/`.
- Regression > 15 percent requires investigation.
- Regression > 25 percent blocks release unless waived by Engineering, SRE, and Security owners.

## Required report fields

- benchmark ID
- dataset version
- git SHA
- environment
- median, p95, p99
- SLO target
- pass/fail result
- raw log URI
- owner sign-off
