# ADR-0028: Grid Engine Dependency Analysis Review (DAR)

**Status:** Proposed  
**Date:** 2026-06-30  
**Deciders:** Engineering Lead, Frontend Owner  
**Related:** `docs/tech-stack-decisions.md`, `docs/review/ui_ux_alternative_development_paths.md`, AGENT-064

## Context

The Phase 0 spreadsheet shell uses a custom DOM `<table>` in `SpreadsheetGrid.tsx`. It satisfies command-first editing but cannot pass BENCH-UX-001 (100k-row interactivity). A grid library decision was deferred in the tech-stack snapshot pending a DAR.

## Decision drivers

- All cell mutations must route through `command_api` (`cell.update`); no direct operational writes.
- Command-state overlays (pending, committed, rejected, ambiguous) must remain visible.
- Theme tokens (`data-theme`, `data-density`) must apply without fighting third-party styles.
- BENCH-UX-001 must be achievable before P1-UX-001 tiling evidence.
- Phase 0 must not introduce license conflicts or post-MVP runtime dependencies.

## Options considered

### Option A: Native custom evolution (react-window)

Virtualize rows via `react-window` in the existing `SpreadsheetGrid`. Retain full CSS control and zero new grid license risk.

### Option B: Glide Data Grid (canvas POC)

Replace grid rendering with Glide Data Grid on a spike branch. Wire `onCellEdited` → existing `cell.update` pipeline. Evaluate theme API and selection behavior.

### Option C: Luckysheet / Handsontable

Rejected for Phase 0 DAR: higher bundle weight, formula/features beyond scope, and heavier styling integration cost.

### Option D: Headless batch sync (Path C)

Rejected: conflicts with command-first per-cell identity and ambiguity recovery model.

## Proposed decision (pending POC evidence)

Adopt **Hybrid A+B**:

1. Ship **react-window** virtualization in the main path as the safe fallback (AGENT-064).
2. Run a **Glide Data Grid POC branch** with identical command wiring.
3. Accept Glide only if POC passes all criteria below; otherwise retain react-window.

## POC acceptance criteria (AGENT-064)

```text
- onCellEdited invokes cell.update through commandClient with same envelope shape as SpreadsheetGrid
- pending/committed/rejected/ambiguous overlays visible during command lifecycle
- theme tokens (dark/light, comfortable/compact) produce acceptable visual parity
- 10,000-row dataset: scroll and edit remain interactive on dev hardware
- no mutation path outside command_api (UI-008 compliant)
- evidence: ci://tests/ui/glide-poc-cell-update-wiring
- benchmark: ci://benchmarks/BENCH-UX-001 (react-window path must pass regardless of Glide outcome)
```

## Consequences

- **Positive:** Evidence-based grid choice; scalability path without abandoning command-first UX.
- **Negative:** Dual implementation effort during POC window; ADR remains Proposed until evidence attached.
- **Neutral:** `packages/ui` extraction (AGENT-065) should target the chosen grid adapter interface.

## Links

- `docs/ui/spreadsheet-native-ux-specification.md`
- `docs/gates/P1-UX-001-tiled-spreadsheet-workspace-spike.md`
- `docs/qa/ui-benchmark-plan.md`