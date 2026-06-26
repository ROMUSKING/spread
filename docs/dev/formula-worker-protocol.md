# Formula Worker Protocol

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Purpose

Define resident graph, delta messages, stale-safe behavior, and rebuild protocol.

## Normative behavior

Workers maintain resident formula graph state. Ordinary edits send delta messages. Full graph rebuild occurs only during warm-up, version mismatch, corruption recovery, or cache invalidation.

## API/schema examples

Delta command shape: `{ workbookId, graphVersion, nodeId, changedScalars, traceId, correlationId }`.

## Failure modes

Version mismatch or corrupt graph triggers rebuild. Decision-critical stale output must block or render stale-safe state.

## Required tests

- `ci://benchmarks/BENCH-FORM-001`
- `ci://tests/formula/worker-graph-corruption-recovery`
- `ci://tests/formula/stale-safe-decision-critical-blocking`

## Observability fields

- `workbook_id`
- `graph_version`
- `node_id`
- `worker_state`
- `delta_bytes`
- `eval_ms`

## Owner role

Formula Owner

## Links

- `docs/gates/P1-FORM-001-formula-worker-resident-graph.md`
- `docs/adr/ADR-0004-formula-worker-resident-graph.md`
