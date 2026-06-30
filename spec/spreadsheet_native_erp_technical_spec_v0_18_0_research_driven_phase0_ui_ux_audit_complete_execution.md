# Spreadsheet-Native ERP Technical Specification v0.18.0

**Date:** 2026-06-30  
**Status:** Phase 0 UI/UX audit closure and command-synergistic improvement roadmap  
**Supersedes:** v0.17.0 bootstrap-complete baseline  
**Version note:** This is **v0.18.0**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, security, QA, SRE, product, and AI coding agents.

## 1. Executive Summary

v0.18.0 closes a formal UI/UX audit of the Phase 0 spreadsheet shell and adds a command-synergistic improvement roadmap without widening Phase 0 runtime scope. The product still starts with command identity, durable outbox polling, security invariant CI, transactional-batch partition validation, hot-path rate limiting, and the safe-cell-edit vertical slice.

The v0.18.0 changes are operational and UX-planning:

```text
- active docs and repository metadata are promoted to v0.18.0;
- §11 records UI/UX audit findings, accepted hybrid grid strategy, and AGENT-061..065 work orders;
- §10 corrections document shipped preview tiling, keyboard model, and known stubs;
- UX specification extended with column metadata, action columns, cross-workbook reactivity, and grouped flattened views;
- grid engine DAR stub ADR-0028 added with Glide POC acceptance criteria.
```

## 2. Non-Negotiable Phase 0 Boundary

```text
All mutations go through command_api.
Live updates use durable outbox polling first.
Security invariants are executable and release-blocking.
Post-MVP planes remain feature-flagged off in the ordinary edit path.
Agents may not weaken validation or smoke tests to merge faster.
```

## 3. Runnable Bootstrap Additions

| Area | v0.17.0 state | v0.18.0 refinement |
|---|---|---|
| UI/UX documentation | spreadsheet-native UX spec and paths report existed. | Audit closure, hybrid path accepted, synergistic enhancements specified. |
| Work orders | AGENT-060 vertical slice UI defined. | AGENT-061..065 UX synergy and scale work orders added; AGENT-060/100 re-scoped. |
| Grid engine | DAR deferred in tech-stack decisions. | ADR-0028 stub with react-window + Glide POC criteria. |
| Preview tiling | Shipped ahead of P1-UX-001. | Clarified as scaffolding; P1-UX-001 evidence still required for production tiling. |

## 4. Active Repository Shape

```text
apps/api      command API, outbox polling, SSE, integration staging stubs
apps/web      spreadsheet UI shell (preview tiling, command-status client)
packages/*    domain, db, contracts, config, observability, testkit, ui
docs/         active documentation plus archive
invariants/   executable invariant manifest and SQL checks
tests/        manifest and fixtures
scripts/      validation and smoke-test utilities
```

## 5. Required Bootstrap Checks

Every PR that modifies implementation-critical files must run:

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
bash scripts/smoke-package-tests.sh
```

## 6. Active Canonical Files

| Area | Path |
|---|---|
| First-read snapshot | `docs/snapshot-v0.18.0.md` |
| Agent instructions | `AGENTS.md` |
| UI/UX specification | `docs/ui/spreadsheet-native-ux-specification.md` |
| UI paths report | `docs/review/ui_ux_alternative_development_paths.md` |
| Grid engine DAR | `docs/adr/ADR-0028-grid-engine-dar.md` |
| Project structure | `docs/implementation/project-directory-structure.md` |
| Stub index | `docs/implementation/code-stub-index.md` |
| Test manifest | `tests/manifest.yml` |
| Invariants | `invariants/security-invariants.yml` |
| SLO baseline | `docs/slo-baseline.yml` |

## 7. Final v0.18.0 Recommendation

Proceed with Phase 0 implementation using the active work-order catalog. The bootstrap remains structurally validated and smoke-typechecked. The implementation sequence is:

```text
AGENT-000 -> AGENT-001 -> AGENT-010 -> AGENT-011 -> AGENT-012
  -> AGENT-013 -> AGENT-022 -> AGENT-060 (vertical slice green)
  -> AGENT-061 -> AGENT-062 -> AGENT-063 -> AGENT-064 -> AGENT-065
  -> AGENT-090 -> AGENT-100 -> P1-UX-001
```

Do not admit TigerBeetle, pgvector, DuckDB, broker/CDC, full tiled UI runtime, or external connector runtime into the ordinary edit path until the relevant post-MVP evidence gates pass.

## 8. v0.18.0 Review Closure

v0.18.0 addresses the UI/UX audit by documenting gaps, accepting a hybrid grid strategy (Path A incremental + Path B Glide POC), and defining command-synergistic enhancements that exploit outbox fan-out, column metadata, and domain-command gestures without bypassing command_api.

The release does not widen Phase 0 runtime scope. Post-MVP systems remain documented and feature-flagged off until their evidence gates pass.

## 9. v0.18.0 Bootstrap Continuity

v0.18.0 preserves the v0.17.0 runnable-bootstrap achievement:

```text
- P0-EXEC-001 remains green; bootstrap evidence archived at v0.17.0 QA docs;
- smoke-typecheck and package smoke tests remain mandatory;
- command-first, polling-first, invariant-gated boundaries unchanged;
- preview tiling in apps/web is scaffolding, not P1-UX-001 completion.
```

## 10. v0.18.0 Spreadsheet-Native UI/UX Baseline (Corrected)

The Phase 0 UI shell ships the following capabilities. Corrections from the v0.17.0 spec are noted inline.

- **Empty Row (Unbounded Entry):** Trailing empty row at the bottom of the grid; typing creates a row via `cell.update` and spawns a new empty row underneath.
- **Dynamic Columns:** Columns discovered from server workbook metadata. **Correction:** the trailing "+" column header is a **UI-only stub**; no `column.add` command persists columns server-side yet.
- **Keyboard Navigation Model:** Tab and Shift+Tab wrap across rows; Enter/F2/double-click activate edit; Enter during edit commits and moves focus **down** (not to the next column); type-to-enter; Delete/Backspace clear focused cells.
- **Filesystem Navigator:** Explorer panel with category/workbook tree and relation links.
- **Workbook Tabs & Tiled Presets:** Module switcher and seven business presets (Master Data, Sales OTC, Warehouse, Procurement, Customer, Returns, Financials).
- **Resizable Tile Dividers:** Pointer-capture split handles in `TiledWorkspace` (shipped).
- **Sub-views per Tile:** Grid, Transposed Detail, Relations graph, Explorer, and Business Actions tiles.
- **SVG Relational Graph:** Interactive workbook dependency navigator.
- **Transposed Detail:** Vertical field editor using the same `cell.update` command shape as the grid.
- **Dynamic Module Switcher:** Workbook tabs with server allowlist verification.
- **Business Command Center:** Domain command forms (product, inventory, sales/purchase orders, parties, returns, payments).

**Preview tiling scope note:** The above exceeds AGENT-060 minimal scope. It is **preview scaffolding** for UX evaluation. P1-UX-001 evidence and AGENT-090 vertical-slice green remain gates before treating tiling as production-ready.

## 11. v0.18.0 UI/UX Audit Closure & Improvement Roadmap

### 11.1 Audit findings

| Priority | Gap | Impact |
|---:|---|---|
| 1 | No grid virtualization | BENCH-UX-001 (100k rows) cannot pass; DOM table scales poorly |
| 2 | Column metadata unused | Server discovers `__type__`/`__enum__` meta; UI renders plain text |
| 3 | `cell.update` bypass | Business-critical columns editable without domain commands |
| 4 | Cross-workbook reactivity | Hardcoded refresh lists; no `affects_workbooks` outbox fan-out |
| 5 | Flattened SalesOrders clutter | Header fields repeat per line; no client grouping |
| 6 | Column add stub | Local-only; not persisted via command_api |
| 7 | `page.tsx` monolith | ~1,270 lines; `packages/ui` remains types-only stub |
| 8 | Testing gap | Smoke tests check wiring only; no BENCH-UX evidence |

**Strengths retained:** command-first mutations, optimistic lifecycle overlays, SSE snapshot gating, design-token CSS system, resizable tile dividers, business command forms.

### 11.2 Accepted development path: Hybrid A+B with command synergy

```text
Path A (immediate): react-window viewport virtualization, keyboard polish, packages/ui extraction
Path B (DAR spike): Glide Data Grid POC branch wiring onCellEdited -> cell.update
Synergistic enhancements (no DDL):
  - column metadata rendering (enum select, currency format, read-only hints)
  - protected column visual + server rejection policy
  - affects_workbooks outbox field + automatic tile refresh
  - action columns / gestures triggering domain commands
  - client grouping for flattened order rows (HDR convention)
```

**Explicitly deferred:** Path C headless batch queue, offline-first queue, full tiled workspace runtime (P1-UX-001), formula worker tiles, broker/CDC fan-out.

### 11.3 Normative UX behaviors to implement

1. **Column metadata contract:** Extend `GridColumn` with optional `type`, `format`, `enumOptions`, `readOnly`, `protected`. Server column discovery returns meta from cells convention rows (`__type__`, `__enum__`, `__format__`).
2. **Protected columns:** Generic `cell.update` rejects writes to protected columns unless envelope carries a registered domain `commandType`. UI renders protected cells with read-only styling and action affordances.
3. **Cross-workbook refresh:** Outbox events may include `affects_workbooks: string[]`. Client refreshes all open tiles whose `workbookId` appears in that list.
4. **Action columns:** Client-only virtual columns or gutter gestures submit domain commands (`salesOrder.create`, `fulfillment.allocate`, etc.) through existing `command_api`.
5. **Ambiguity copy:** `SYNC_REQUIRED` and ambiguous outcomes use stable user-facing wording per `docs/dev/client-optimistic-ui-and-conflicts.md`, preserving command ID in a details panel.

### 11.4 Work orders

| ID | Objective | Evidence |
|---|---|---|
| AGENT-061 | Column metadata rendering | `ci://tests/ui/column-meta-renders-enum-select` |
| AGENT-062 | Cross-workbook live refresh via `affects_workbooks` | `ci://tests/ui/cross-workbook-tile-refresh` |
| AGENT-063 | Flattened order client grouping + HDR styling | `ci://tests/ui/sales-order-group-rendering` |
| AGENT-064 | Grid scalability: react-window + Glide POC for DAR | `ci://benchmarks/BENCH-UX-001`, `ci://tests/ui/glide-poc-cell-update-wiring` |
| AGENT-065 | Extract `packages/ui` + refactor `page.tsx` hooks | `ci://tests/ui/command-status-visible-in-tiles` |

**Re-scoped work orders:**

- **AGENT-060:** Current shell is preview scaffolding; acceptance remains one safe-cell e2e green before P1-UX-001 expansion.
- **AGENT-100:** Metadata hooks and action columns are allowed; broad tiling runtime remains forbidden until P1-UX-001.

### 11.5 Grid DAR gate

ADR-0028 defines acceptance criteria. Glide POC must demonstrate `onCellEdited` → `cell.update` command pipeline, theme token compatibility, and command-state overlays before ADR acceptance. react-window remains the fallback if Glide fails DAR criteria.