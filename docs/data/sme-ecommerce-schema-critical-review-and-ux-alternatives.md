# Critical Review: SME Ecommerce Schema Spec + UX Synergy Alternatives

**Date:** 2026-06-27  
**Status:** Draft for review  
**Related:** `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md`
(the "schema spec")  
**Scope:** Phase 0 only. Command-first, current_cell_values physical, dynamic
columns, outbox polling SSE, tiled spreadsheet UI, batch policies,
NumericLedgerPort (MVP PG).

## Executive Summary

The schema spec proposes a solid **hybrid cell + coarse domain command model**
for 8 logical workbooks (Products, Customers, Suppliers, Warehouses,
InventoryBalances, SalesOrders (flattened), PurchaseOrders, Fulfillments). It
correctly prioritizes Phase 0 constraints (no DDL, reuse `current_cell_values` +
`compilePartitions`, ledger for conserved stock/money, primitives coexist with
domain cmds).

**Strengths:**

- Strong synergy with backend (CommandProcessor tx boundary, ledger adapter
  participation, semantic outbox events, batch Union-Find on
  order_id/product+warehouse).
- Good fit for current spreadsheet UX (dynamic column discovery from cells in
  `server.ts:369`, GROUP-BY-row_id pattern, trailing empty row + `cell.update`).
- Addresses pilot pain (fragile `item_name` → stable id refs; invariants via
  handlers + customDomainRules).
- Flattened SalesOrders rationale is well-justified for existing transposed
  detail + grid.

**Critical Weaknesses (high impact for FE/BE/UX):**

1. **Bypass and invariant enforcement gap**: The grid + `cell.update` remains
   fully open. Domain commands (e.g. `salesOrder.create`, `inventory.adjust`)
   can be bypassed by direct cell edits on status, qty, prices. Handlers only
   protect when using the coarse command path. UI "guidance" is weak mitigation.
2. **Flattened model UX friction**: Repeating header data (customer, order
   status) on every line row clutters grid view, makes transposed detail
   incomplete for the full order, and complicates summaries/aggregates. HDR row
   convention helps but is ad-hoc.
3. **Pure discovery columns limit business UX**: Columns are pure `value_text`
   with derived labels (`server.ts:370`). No typing, enums, formats, required
   flags, or validation hints. Business users get plain text grid for prices,
   statuses, quantities — far from polished ERP feel while claiming
   "spreadsheet-native".
4. **Reactivity and cross-workbook live updates are under-specified**: SSE is
   per-workbookId (page.tsx subscribes all ALLOWED independently). A domain
   command touching Sales + Inventory emits events, but client may not correlate
   or refresh the "related" tile automatically. Relations graph exists but is
   mostly static navigator.
5. **Navigation scale & tiled synergy underused**: 8 workbooks will overwhelm
   the module tab bar and explorer. TiledWorkspace (grids + transposed + graph +
   explorer side-by-side) + relations edges are powerful but the schema spec
   doesn't leverage them for master-detail, live linked views, or action
   integration.
6. **Derived data fragility**: `quantity_available` etc. are command-written
   cells. Direct edits or out-of-sync SSE can break invariants until re-compute.
   No tie-in to future RetrievalRevalidator or client projections.
7. **Command integration in UI is missing**: Spec focuses on backend
   commandTypes and payloads. FE remains almost entirely cell-oriented. No clear
   path for users to invoke `fulfillment.allocate` or `order.fulfillShip` from
   the grid/transposed without leaving the spreadsheet paradigm.

Overall Phase 0 synergy score of original spec: 7.5/10 (strong backend
alignment, good storage model choice, but weak on "enhancing UI/UX" and full
tiled + live reactivity exploitation).

## Detailed Critical Analysis

### Alignment with Existing Architecture (Backend)

**Good synergy:**

- Reuses `CommandHandlerBase.executeBusinessLogic(context: {tx, ledger})` +
  processor Boundary B tx (cells + ledger + outbox insert + AUD-001).
- Batch policies directly feed `compilePartitions` (evidence.test.mjs already
  exercises on productId+warehouseId).
- Ledger usage matches `ledgerability-classification.md` (stock on_hand/reserved
  ledgerable) and numeric contract (movementKind, domainObjectRef, commandId
  threading).
- Outbox semantic events (`salesOrder.created`, `stock.reserved`) +
  partition_key enable targeted polling/SSE.

**Gaps:**

- Cross-workbook mutations in one command (sales lines + inventory) rely on
  handler writing multiple workbooks' cells in one tx. Current SSE subscriptions
  are independent per workbookId; no automatic fan-out or "affects" list.
- No server-side protection for "protected" columns on generic `cell.update`
  (e.g. you can still cell-edit a shipped order qty).
- Column contracts remain purely logical/docs (pilot-dataset + spec). No runtime
  enforcement or metadata beyond distinct column_ids.

### Alignment with Frontend / Spreadsheet-Native UX

Current UX (from `docs/ui/spreadsheet-native-ux-specification.md`,
TiledWorkspace, SpreadsheetGrid, ExplorerPanel, TransposedDetail, page.tsx):

- Unbounded grid with trailing empty row → `cell.update`.
- Dynamic columns discovered server-side, no hard-coded defs.
- Keyboard-first (arrows, tab wrap, type-to-edit, F2/Enter/Del).
- Module tabs + tiled split (grid + detail + explorer + graph).
- Optimistic states via commandStates (pending yellow, committed green, etc.).
- Relations graph from workspace edges (contains + custom relations).
- Transposed vertical detail for focused row editing.
- SSE per workbook, client merges into `workbookRows` / `workbookColumns`.

**Where schema spec helps:**

- ID-based keys (product_id etc.) enable reliable relations graph edges and
  cross-tile navigation/filtering.
- Multiple workbooks map naturally to module tabs + explorer folders.
- Flattened + row_id grouping matches existing server query (GROUP by row_id)
  and transposed (one row at a time).

**Where it falls short for enhancing UX:**

- No evolution path for richer column presentation (currency, status badges,
  dropdown enums for DRAFT/CONFIRMED/SHIPPED).
- Business operations (create full order with lines + reserve stock atomically)
  feel like "API calls" rather than natural grid gestures.
- Live updates between tiles (edit sales → inventory stock cell updates live)
  are possible via SSE but not explicitly designed or demonstrated.
- Tiled power (split sales grid + inventory grid + graph + transposed detail) is
  under-specified as the primary way users experience multi-workbook ecommerce
  flows.
- Risk that 8 workbooks make the UI feel like "8 separate spreadsheets" instead
  of an integrated ERP.

## Alternative Approaches Considered

### 1. Data / Schema Modeling Alternatives

**A. Enhanced Flattened + Client Grouping (Recommended refinement)** Keep
physical flattened rows + HDR convention. Add client-side grouping logic in
SpreadsheetGrid / TiledWorkspace when workbook === SalesOrders: detect \*-HDR vs
lines, render header summary row + collapsible lines. Use `order_id` as visual
group key. **Synergy:** Zero change to storage, batch policy (partition on
order_id), commands, outbox. Leverages existing row_id GROUP pattern. **UX
gain:** Cleaner grid view for orders, still spreadsheet-like. Transposed can
target line or promote to header context.

**B. Lightweight Column Metadata (cells-based, no DDL)** Introduce convention:
rows with row*id starting
`\_meta*`or a dedicated meta workbook (or cells with column_id prefixed`**type**`, `**enum**`, `**format**`). Server (or client) reads meta on column discovery and augments `GridColumn`
with type, options, required, displayFormat. Example columns for Sales:

- status: {type: 'enum', options: ['DRAFT','CONFIRMED',...], ui: 'select'}
- unit_price: {type: 'number', format: 'currency'} **Synergy:** Still 100%
  dynamic columns + cell storage. Commands can write/validate against meta.
  Future RetrievalRevalidator or formula worker can use same meta. **UX gain:**
  Huge. Dropdowns for status in grid/transposed, number formatting, required
  indicators, better footers. Feels like a smart spreadsheet for business data.

**C. Linked Workbooks (Headers + Lines) with Virtual Projection**
SalesOrderHeaders (one row per order) + SalesOrderLines (multiple). Use
workspace edges for "has_lines". Client or future view layer joins on order_id
for display. **Trade-off:** More accurate relational model, easier header-only
edits. But current cell query + transposed + dynamic cols become more complex
(cross-workbook in one grid tile). Batch policy would need cross-workbook
support (currently per-workbook yml). **Why lower for Phase 0:** Violates "keep
it simple for spreadsheet UI" justification in original spec. Defer to
post-vertical when tiled views mature.

**D. Pure Cell + UI Orchestration Only (status quo extreme)** No new coarse
commands for ecommerce flows. Everything via cell edits + client-side "wizards"
that do multiple cell.update calls. **Downside:** Loses atomic tx + ledger
guarantees. Noisy per-cell outbox events. Weak invariants.

**Selected refinement direction:** B (metadata) + A (client grouping on
flattened) on top of the hybrid command model.

### 2. Command + UI Integration Alternatives

**Coarse commands triggered from spreadsheet gestures (strong recommendation):**

- "Action columns" or virtual columns (client-only, e.g. "Actions" column
  showing buttons or special editable values like "[Fulfill]").
- On commit of special value or context menu / gutter action on selected rows →
  submit domain command (salesOrder.create from draft lines, fulfillShip,
  inventory.adjust).
- Handler result can return "suggested cell updates" that are applied
  optimistically + via SSE. **Synergy:** Uses existing commandClient.submit(any
  commandType), commandStates for optimistic, outbox for confirmation. Fits
  keyboard (e.g. special key for actions). Tiled detail view can surface
  "business actions" panel for the current row's order. **UX enhancement:**
  Users stay inside the grid/spreadsheet metaphor while invoking complex logic.
  Feels powerful yet native.

**Fine + coarse hybrid with protected columns:** Extend generic cell handler (or
add middleware) to reject writes to "business critical" columns (status, on_hand
when locked by workflow) unless coming from a registered domain commandType. Use
commandType in envelope or special header. **Synergy:** Still command-first for
mutations. Primitives remain for ad-hoc columns (notes, custom fields). **UX:**
Grid feels safe; business fields become "read mostly" or require explicit
action.

### 3. Live Reactivity & Tiled Synergy

**Event fan-out / related workbooks:**

- Domain commands emit primary outbox event + secondary "related" events or
  include `affects_workbooks: ['014', '015']` in payload.
- Client (page.tsx handleSseEvent + TiledWorkspace) subscribes broadly or reacts
  to related events by refreshing tiles that have matching relations from the
  graph. **Synergy:** Outbox already supports workbook_id + partition_key.
  ExplorerPanel already computes getRelatedWorkbooks from edges. Tiled split
  views become live dashboards (sales grid tile + inventory tile update
  together).

**Relations-driven filtering and navigation:**

- Click edge in WorkbookGraph or Explorer "related" list → open/split a tile for
  the target workbook, pre-filtered client-side to rows referencing the selected
  id (e.g. filter inventory where product_id matches). **UX win:** Turns the
  schema's id-based relations into first-class navigation, making the 8
  workbooks feel integrated rather than siloed.

### 4. Other UX Polish Tied to Schema

- **Status & derived visualization:** Client renders special columns (status,
  quantity_available) with badges, color, progress using column meta (alt B).
  Even without meta, hard-code for known business columns (order status, stock
  levels).
- **HDR row special rendering:** In grid, promote \*-HDR rows to sticky group
  headers or different styling.
- **Command preview in transposed:** Before committing a domain command, show
  "preview" cells that would change (optimistic simulation).
- **Reduced tab clutter:** Limit top-level module tabs to primary flows (Sales,
  Inventory, Purchasing). Use explorer + graph + quick-open for others. Tiled
  supports opening any allowed workbook in a tile.
- **Keyboard business actions:** Extend keyboard model (e.g. Cmd/Ctrl+Enter on
  selected lines = "create/fulfill").

## Recommended Updates to the Schema Spec

1. Adopt "Lightweight Column Metadata via cells convention" (Alternative B) as
   the primary evolution path for Phase 0/0.5. Document the `__type__` / meta
   row convention. Update server column discovery and client GridColumn type.
2. Strengthen "Primitives coexist" section: explicitly call out bypass risk and
   recommend (a) UI preference for domain actions, (b) future protected-column
   logic in cell handler, (c) audit logging of direct edits to business columns.
3. Expand "Relations & Graph" and "Cross-workbook" sections with concrete
   proposals for event fan-out, client-side related refresh, and filtered tiles.
4. Add UI/UX section (new): "Integration with TiledWorkspace, TransposedDetail,
   and SpreadsheetGrid". Describe action columns, grouped rendering for
   flattened orders, business actions from detail view.
5. Update flattened rationale: note client grouping as mitigation for UX
   repetition.
6. Revise PR Plan: insert early PR for column meta support + action integration
   before or alongside full handler rollout. Add evidence for live cross-tile
   updates.
7. Keep hybrid coarse commands as the model for atomicity and invariants.

These changes keep full backward compatibility with cell model, dynamic
discovery, existing commands, tiled UI, and Phase 0 constraints while
significantly improving business usability and "integrated ERP" feel over "just
8 spreadsheets".

## Risks if Not Addressed

- Users treat the grids as dumb spreadsheets and corrupt data (bypass).
- With 8 workbooks the UI feels fragmented instead of synergistic.
- Live updates only work within a single workbook tile → poor perception of
  "real-time ERP".
- Domain commands remain backend-only curiosities rather than the primary
  interaction model.

## Conclusion

The schema spec is a good foundation that respects the architecture. With the
refinements above (metadata for richer columns, action integration in the
existing grid/transposed/tiled surface, stronger cross-workbook reactivity via
outbox + relations, client grouping on flattened data), it can deliver **much
stronger UI/UX** while preserving every spreadsheet-native and command-first
principle.

This review should be incorporated into the main spec or used as input for the
next design iteration / PR.

**Next steps (if approved):**

- Prototype column meta convention + one action column in a dev branch.
- Demonstrate sales create + live inventory update across split tiles.
- Run full validation + smoke after any doc/code changes.

## Implementation Tracking (added during "create tables with sample data cross linked" task)

- Status: fixed (sample data population for 8 workbooks) Response: Rich
  cross-linked demo data added to InMemoryQueryable seed using exact spec UUIDs
  010-017
  (Products/Customers/Suppliers/Warehouses/InventoryBalances/SalesOrders-flattened/PurchaseOrders/Fulfillments).
  All cells include full tenant/workbook threading. ID refs (product_id etc)
  throughout; flattened HDR/Lxx for Sales; realistic flows (SO-001 shipped
  linked via order_id/product_id to FUL-001 + adjusted Inventory on p1/p3;
  SO-002 DRAFT fits p2 avail). Matches handler cell writes. Added simple
  cells-based meta convention rows. Minor discovery filter in server for clean
  meta convention. Updated nodes/edges + one fixture comment. No DDL. Backward
  pilot preserved. Addresses "strong emphasis on ... rich, cross-linked sample
  data".
- Other recs (client grouping in grid, domain action buttons in UI, full tiled
  reactivity fanout) noted as future per Phase 0 scope; data enables them.

References: All files cited in the main schema spec + current
`apps/web/src/{app/page.tsx,components/{TiledWorkspace,SpreadsheetGrid,ExplorerPanel,TransposedDetail,WorkbookGraph}}.tsx`,
`apps/api/src/server.ts` (column discovery),
`docs/ui/spreadsheet-native-ux-specification.md`.
