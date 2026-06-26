# CHANGELOG v0.13.2

**Date:** 2026-06-26  
**Status:** Review-closure baseline

## Added

- `docs/onboarding/minimal-reading-path.md` role-based reading matrix.
- `docs/maintenance/normative-source-map.md` drift-control map.
- `docs/data/outbox-polling-performance-contract.md` with polling budgets, query patterns, EXPLAIN expectations, covering indexes, and high-churn bloat scenario.
- `docs/data/ledger-id-derivation-reference.md` with TypeScript + SQL reference implementations, test vectors, property-based tests, and payload-hash parity rules.
- `docs/dev/retrieval-revalidator.md` and `docs/api/retrieval-revalidator.openapi.yml` for mandatory cross-plane retrieval revalidation.
- `docs/ops/failure-mode-catalog.md` with top 20 failure modes and mixed-plane chaos assertions.
- `docs/slo-target-rationale.md` with target rationale and dataset metadata requirements.
- `docs/review/critical-review-v0.13.2.md` review closure.

## Changed

- Promoted active pack metadata to v0.13.2.
- Updated the active spec to `spec/spreadsheet_native_erp_technical_spec_v0_13_2_research_driven_phase0_outbox_review_closure_execution.md`.
- Strengthened P0-LIVE-001 with polling performance, demand filtering, EXPLAIN, and retention-gap evidence.
- Strengthened P1-OUTBOX-001 to prove MVP polling reader is not regressed by post-MVP fan-out envelope fields.
- Reworked numeric-ledger contract to point to the dedicated ledger ID reference instead of carrying the full implementation inline.
- Updated AI and SYNERGY gates to require `RetrievalRevalidator` before user-visible cross-plane results.
- Expanded observability metrics/spans/alerts for outbox, ledger, retrieval, and mixed-plane failure paths.
- Added SLOs and benchmark entries for `BENCH-LIVE-OUTBOX-POLL-001`.
- Added `LEDGER-008`, `OUTBOX-007`, and `AI-009` invariants.

## Unchanged

- MVP remains PostgreSQL-backed and polling-first.
- No broker/CDC, TigerBeetle, pgvector, or DuckDB dependency is added to the Phase 0 vertical slice.
- All mutations remain command-mediated.
