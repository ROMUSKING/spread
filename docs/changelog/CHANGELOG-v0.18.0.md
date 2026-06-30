# CHANGELOG v0.18.0

**Date:** 2026-06-30  
**Status:** UI/UX audit closure and command-synergistic improvement roadmap

## Added

- `spec/spreadsheet_native_erp_technical_spec_v0_18_0_research_driven_phase0_ui_ux_audit_complete_execution.md` with §11 UI/UX audit closure.
- `docs/snapshot-v0.18.0.md` with UI/UX audit references and AGENT-061..065 sequence.
- `docs/adr/ADR-0028-grid-engine-dar.md` stub with hybrid react-window + Glide POC criteria.
- `docs/implementation/phase0-work-order-assignments-v0.18.0.md` extending assignments through AGENT-065.
- `docs/review/critical-review-v0.18.0.md` closing the UI/UX audit.
- AGENT-061 through AGENT-065 work orders in `docs/implementation/phase0-agent-work-orders.md`.
- UX spec §5–§8: column metadata, action columns, cross-workbook reactivity, grouped flattened views.

## Changed

- Promoted active spec, snapshot, package metadata, manifest, invariants, SLOs, README, pack index, validation, and CI to v0.18.0.
- Corrected spec §10 keyboard model (Enter moves down), column-add stub note, and preview tiling scope.
- Finalized `docs/review/ui_ux_alternative_development_paths.md` to Accepted (Hybrid A+B).
- Re-scoped AGENT-060 (preview scaffolding) and AGENT-100 (action columns allowed; tiling runtime forbidden).
- Archived v0.17.0 spec and snapshot under `docs/archive/`.

## Scope unchanged

Phase 0 remains command-first, polling-first, invariant-gated, and narrow. No TigerBeetle, pgvector, DuckDB, broker/CDC, external connector runtime, or full tiled UI runtime is admitted to the ordinary edit path.