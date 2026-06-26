# Gate: P1-FORM-001 - Formula Worker Resident Graph

**Version:** 0.16.1  
**Last-reviewed:** 2026-06-26  
**Owner:** Formula Owner  
**Priority:** P1  
**Waiver allowed:** Yes for non-decision-critical formulas only  
**Normative spec:** v0.16.1 sections 10 and 12.6  
**SLO reference:** `docs/slo-baseline.yml`

## Requirement

Formula worker threads must avoid full workbook graph cloning per edit and must fail stale-safe.

## Required behavior

- Warm worker graph on workbook open or formula-heavy sheet access.
- Send delta messages for ordinary edits.
- Rebuild graph safely after corruption or version mismatch.
- Measure warm edit, cold start, and rebuild latency.
- Decision-critical formula cells block or render stale-safe state when worker state is stale.
- Evaluate SharedArrayBuffer only if payload size or transfer cost warrants it.
- Rust/WASM proposal must include bridge and data-transfer cost.

## Evidence required

- `ci://benchmarks/BENCH-FORM-001`
- `ci://tests/formula/worker-graph-corruption-recovery`
- `ci://tests/formula/stale-safe-decision-critical-blocking`

## Failure behavior

Scope formula rollout down to non-decision-critical formulas until worker evidence passes.
