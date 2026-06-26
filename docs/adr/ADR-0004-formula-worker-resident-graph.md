# ADR-0004: Formula Worker Isolation with Resident Graphs

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required before formula-heavy rollout

## Context

Node.js worker threads are appropriate for CPU-intensive JavaScript operations, but cloning large formula graphs across worker boundaries can dominate computation cost.

## Decision

Use worker threads with resident workbook/formula graph state. Normal edits send small delta commands. Full graph rebuilds occur only during warm-up, version mismatch, corruption recovery, or explicit cache invalidation.

## Consequences

- Main event loop stays responsive.
- Worker data transfer remains bounded.
- Formula workers require graph versioning and rebuild protocol.
- Rust/WASM remains evidence-gated against this optimized TypeScript baseline.
- Decision-critical formula cells must block or show stale-safe state when the worker is stale.

## Acceptance

- `BENCH-FORM-001` meets SLO targets or formula rollout is scoped down.
- Corruption and version mismatch tests trigger rebuild rather than crash or silent stale values.
