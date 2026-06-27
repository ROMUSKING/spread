# CHANGELOG v0.17.0

**Date:** 2026-06-26  
**Status:** Bootstrap-complete delivery polish baseline

## Added

- `docs/snapshot-v0.17.0.md` with an explicit **Bootstrap achieved** note and next AGENT work-order path.
- `scripts/smoke-package-tests.sh` and dependency-free Node package smoke tests for `apps/*` and `packages/*`.
- `docs/qa/bootstrap-completion-evidence-v0.17.0.md` tying validation, smoke typecheck, package tests, ZIP integrity, and agent simulation evidence together.
- `docs/implementation/phase0-work-order-assignments-v0.17.0.md` for AGENT-000 through AGENT-012.
- `docs/release/vertical-slice-release-note-template.md` for the future first safe-cell-edit release note.
- `EXEC-015`, `EXEC-016`, `SNAP-004`, and `BENCH-REPO-003` validation targets.

## Changed

- Promoted active spec, snapshot, package metadata, manifest, invariants, SLOs, README, pack index, validation, and CI to v0.17.0.
- `scripts/smoke-typecheck.sh` now explains the purpose of the bootstrap smoke check and resolves TypeScript via local install, `pnpm exec`, or global `tsc`.
- Root smoke scripts now run both TypeScript smoke typecheck and package smoke tests.

## Scope unchanged

Phase 0 remains command-first, polling-first, invariant-gated, and narrow. No TigerBeetle, pgvector, DuckDB, broker/CDC, external connector runtime, or full tiled UI is admitted to the ordinary edit path.
