# Changelog v0.13

**Date:** 2026-06-26  
**Status:** Post-MVP data-plane strategy baseline

## Promoted

- Promoted the v0.12.x hardening line into the v0.13 minor baseline.
- Made the post-MVP specialized-plane strategy a first-class pack concern.
- Kept Phase 0/MVP scope unchanged: command-first, polling-first, invariant-driven, and PostgreSQL-backed.

## Canonical strategy

```text
PostgreSQL = operational/control/projection plane
TigerBeetle = numeric ledger plane after evidence/cutover
pgvector = semantic retrieval plane after P1-AI evidence
DuckDB = analytics/export/reconciliation plane after P1-ANALYTICS evidence
```

## Guardrails

- No specialized engine in the ordinary edit path.
- No AI/analytics mutation path outside command handlers.
- No DuckDB user-facing production-primary scans.
- No pgvector authorization decisions.
- No TigerBeetle adoption without P1-LEDGER evidence and reconciliation.

## Active versioned artifacts

- `spec/spreadsheet_native_erp_technical_spec_v0_13_research_driven_phase0_system_integration_strategy_execution.md`
- `docs/pack-index.md`
- `docs/slo-baseline.yml`
- `tests/manifest.yml`
- `invariants/security-invariants.yml`
- `scripts/validate-pack.sh`
## v0.13 pgvector synergy refinement

- Added `docs/data/pgvector-integration-strategy-options.md` with evaluated alternatives and selected model.
- Added `docs/data/semantic-retrieval-contract.md` as the canonical AI/pgvector schema contract.
- Added hybrid lexical/vector retrieval as the default user-facing strategy.
- Added `docs/qa/ai-benchmark-plan.md`, `docs/ops/pgvector-retrieval-runbook.md`, and `docs/diagrams/pgvector-semantic-plane.md`.
- Strengthened P1-AI-001 with ANN recall/filtering, dedicated semantic database feed, and DuckDB-assisted chunk-generation evidence.
