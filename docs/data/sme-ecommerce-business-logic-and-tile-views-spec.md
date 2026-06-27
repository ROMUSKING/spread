# SME Ecommerce Business Logic Workflows and Core Application Tile Views Spec

**Document ID:** SPEC-ECOM-LOGIC-VIEWS-001  
**Version:** 0.17.0 (extension to domain data model spec)  
**Date:** 2026-06-27  
**Status:** Draft for review  
**Audience:** Phase 0 engineers, AI agents  
**Prerequisites:** Read `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md`, the critical review (`docs/data/sme-ecommerce-schema-critical-review-and-ux-alternatives.md`), `docs/dev/batch-partition-policy.md`, `docs/dev/command-lifecycle.md`, AGENTS.md, and `docs/ui/spreadsheet-native-ux-specification.md`.

## 1. Executive Summary

This spec defines **business logic** (command-driven workflows) and **UI organization** (grouping of spreadsheet tiles into core business application views) for the SME online ecommerce + owned warehouse domain.

It extends the prior data model (8+ id-based workbooks stored in `current_cell_values`, flattened lines, ledger for conserved stock/money).

**Key principles (Phase 0 constraints):**
- All mutations via `CommandHandlerBase` subclasses executing in a single PostgreSQL transaction (cells + `NumericLedgerPort` MVP adapter + outbox events).
- Batch partition policies (`workbooks/*/batch-partition-policy.yml` + `compilePartitions`) ensure atomic grouping of related mutations (e.g. by `productId+warehouseId` or `orderId`).
- Durable outbox polling + SSE for live updates across tiles.
- Spreadsheet-native UX: dynamic columns, trailing empty row + `cell.update`, keyboard-first, relations graph, transposed detail, user-driven TiledWorkspace splits.
- No new DDL outside canonical contracts; stick to cells for Phase 0.

**Core deliverables:**
- Full workflow models (creation → operations → transfers → maintenance) expressed as sequences of coarse domain commands.
- Definition of "Core Business Application Views" as named, reusable groupings/presets of tiles (grid + transposed detail + explorer/graph) that provide integrated experiences while allowing users to split/customize.
- Command catalog extensions with payloads, invariants, ledger postings, and outbox events.
- Synergy evaluation of alternatives against backend (tx atomicity, ledger, batch compiler, outbox, RLS) and frontend (TiledWorkspace, SpreadsheetGrid, relations graph, optimistic states, SSE reactivity).

**Recommended approach (Hybrid Command + View Presets):**
- Domain commands for business invariants and multi-workbook atomicity.
- View presets load sensible default tile compositions (e.g. SalesOrders grid + linked Inventory + Fulfillments + graph).
- Users retain full spreadsheet freedom (add columns, edit ad-hoc cells, split tiles).
- Outbox events + relations graph drive cross-tile live updates and navigation within a view.

This keeps the "one safe spreadsheet edit" foundation while adding guided business power.

## 2. Core Business Application Views (Tile Groupings)

Current UI (`TiledWorkspace.tsx`, `page.tsx`) supports fully dynamic tiles: each tile has a `type` ("grid" | "detail" | "explorer" | "graph") and `workbookId`. Users split, change type/workbook, and the global relations graph / explorer can drive selection.

**Problem:** Pure dynamism works for exploration but does not provide "core business application views" that feel like integrated ERP modules (Sales Ops, Warehouse, Procurement) while staying spreadsheet-native.

### 2.1 View Definition

A **Core Business Application View** is:
- A named preset of initial `TileState[]` (type + workbookId + optional selectedRowId or filter hints).
- Recommended layout direction and toolbar actions.
- Logical "related workbooks" (drawn from workspace edges + batch policy FKs/formula refs).
- Default command actions surfaced in the view (e.g. in transposed detail or a lightweight action bar).

Views are **not** rigid forms — every tile remains a full dynamic spreadsheet (columns discovered, trailing empty row for entry, cell edits via `cell.update` as escape hatch).

### 2.2 Recommended Core Views

**1. Master Data View** (product/customer/supplier/warehouse creation & maintenance)
- Default tiles (horizontal split):
  - Grid: Products (010)
  - Detail: Transposed on selected product
  - Explorer + Graph (showing relations to InventoryBalances, Suppliers etc.)
- Optional side grid: Customers (011) or Suppliers (012) — user can split to add.
- Actions: "New Product" (product.create), inline cell edits for prices/costs/tax_rate, "Init Inventory" button that submits inventory.adjust with +delta.
- Synergy: Graph edges auto-suggest adding related inventory tile when selecting a product.

**2. Sales Order Processing (Order-to-Cash / Fulfillment) View**
- Primary: Grid on SalesOrders (015, flattened HDR+lines)
- Linked availability: Grid on InventoryBalances (014) (client or future filter by products in selected order)
- Detail: TransposedDetail on selected line/HDR
- Graph/Explorer: relations (order → customer, lines → products/inventory)
- Default layout: 3-column (orders grid | inventory availability | detail + actions)
- Workflow actions (in detail or context menu on rows):
  - Confirm → salesOrder.confirm
  - Allocate → fulfillment.allocate (updates reserved in inventory + ledger)
  - Fulfill/Ship → order.fulfillShip (moves stock, writes Fulfillments 017, posts ledger COGS/AR)
- Live synergy: `salesOrder.created`, `stock.reserved`, `order.fulfilled` outbox events cause SSE refresh of all tiles in the view.

**3. Warehouse Operations View**
- Grid: InventoryBalances (014)
- Grid or Detail: Pending Fulfillments (017) filtered to this warehouse
- Graph: stock movement edges (from prior fulfill/receive)
- Actions: inventory.adjust (positive for receipts/adjust, negative for issues), cycle count reconciliation command.
- Batch synergy: adjust commands use productId+warehouseId partition so concurrent changes on same location are grouped atomically.

**4. Procurement (Procure-to-Pay) View**
- Grid: Suppliers (012) + PurchaseOrders (016, flattened)
- Linked: Inventory (receive increases on_hand)
- Detail + actions: purchaseOrder.receive (3-way basics, writes inventory + ledger + status)
- Relations graph shows PO → supplier → products → inventory.

**5. Maintenance & Transfers View** (basic for owned warehouse)
- Grids for adjustments/returns across workbooks
- Commands: inventory.returnReceipt, stock.status.change (quarantine etc. via ledger accounts)
- Full audit via outbox + ledger history.

Views are launched from a future "Application Switcher" (extending the existing module tabs idea) or sidebar. Inside a view, the existing split/close/change-workbook UI remains fully available — the preset is just a smart starting point.

**Implementation note for synergy (Phase 0 friendly):**
- Add a small `viewPresets` map in `TiledWorkspace` or page state.
- "Open View: Sales Ops" clears/replaces the tile array with the preset.
- Relations graph `onSelectWorkbook` can do "add related tile" (current global behavior) or "add to current view".
- No change to core Tiled mechanics.

## 3. Business Logic: Command-Driven Workflows

All complex operations are **coarse-grained domain commands** (not sequences of raw `cell.update`). Primitives (`cell.update`, `row.delete`) remain for ad-hoc fixes and user extension (new columns).

Handlers extend `CommandHandlerBase`, run inside the processor's Boundary B tx (with `context.tx` + `context.ledger`), respect batch partition policy for the primary workbook(s) they touch, and must thread identifiers for AUD-001/outbox/ledger.

### 3.1 Extended Command Catalog (building on prior spec)

Existing (partially implemented):
- `product.create` / `product.update`
- `customer.create` / `supplier.create` / `warehouse.create`
- `inventory.adjust`
- `salesOrder.create`

New / extended for full workflows:

- `salesOrder.confirm` (payload: orderId; writes status, may trigger allocate)
- `fulfillment.allocate` (payload: orderId, optional lines; computes available, writes reserved cells + ledger "stock_reserve" transfer, batch-partitioned by product+warehouse)
- `order.fulfillShip` (payload: orderId, fulfillment details, lines; moves reserved→shipped in ledger, writes Fulfillments row, updates sales status, posts COGS + AR)
- `purchaseOrder.receive` (payload: poId, lines with qtyReceived/unitCost; increases on_hand + ledger stock_receive; basic 3-way tolerance in handler)
- `invoice.create` / `payment.record` (AR, revenue, cash, tax liability ledger movements)
- `order.return` / `inventory.returnReceipt` (reversals: stock_return + cogs_reverse + ar_credit; restock or quarantine status)
- Maintenance: `inventory.cycleCount` (reconcile on_hand vs counted; adjustment via ledger), `stock.status.transfer` (available ↔ quarantine etc. via ledger accounts)

**Invariants enforced in handlers + batch customDomainRules** (see existing inventory policy yml for pattern):
- qty >= 0, on_hand >= 0, reserved <= on_hand
- Sufficient available on allocate
- Status transitions legal (DRAFT → CONFIRMED → ALLOCATED → SHIPPED, etc.)
- 3-way match basics on receive (qty within tolerance or flag variance; price match or variance posting)
- Non-negative after adjustments

**Ledger usage (MVP Postgres adapter, per numeric-ledger-contract.md and ledgerability-classification.md):**
- Stock: status accounts (available → reserved → shipped; also quarantine/damaged)
- Money: AR, revenue, COGS (standard_cost snapshot from Product at fulfillment time), cash, tax_liability
- Every transfer carries commandId, commandLineIndex, domainObjectRef (orderId, productId, warehouseId, etc.)

**Outbox domain events** (emitted inside tx, delivered via polling SSE):
- `product.created`, `salesOrder.created`, `stock.reserved`, `stock.shipped`, `order.fulfilled`, `fulfillment.shipped`, `po.received`, `ar.posted`, etc.
- Events include workbookId + partition_key so clients subscribed to related workbooks in a view receive targeted updates.

### 3.2 Example End-to-End Workflows (with Commands, Cells, Ledger, Events)

**Workflow: Product + Initial Stock Setup**
1. UI (Master Data View, Products grid): trailing empty row or "New" action → `product.create` (writes cells in 010; returns id).
2. Optional follow-up in same view or Inventory tile: `inventory.adjust` (+qty, reason="initial") → writes quantity_on_hand + last_adjust_reason in 014; ledger stock_receive transfer.
3. Outbox: `product.created`, `stock.received`.
4. Graph tile auto-updates via SSE; related tiles highlight.

**Workflow: Sales Order to Shipped + Cash (core Order-to-Fulfillment)**
1. Sales Ops View, SalesOrders grid: create lines (customer + products) → `salesOrder.create` (DRAFT cells in 015: order_id, line_id, product_id, qty, unit_price, line_total, tax_amount snapshot, status, customer_id; optional HDR row; no ledger yet).
   - Handler validates products exist (query cells), computes totals.
2. Select order → `salesOrder.confirm` (status → CONFIRMED or directly to allocate).
3. `fulfillment.allocate` (or auto on confirm):
   - Read current on_hand/reserved from Inventory 014 (or ledger projection).
   - For each line: check available >= qty.
   - Write reserved cells (quantity_reserved += qty, available computed via formula dep).
   - Ledger: available → reserved ("stock_reserve").
   - Batch policy on Sales (order_id) + Inventory (product+wh) groups related mutations.
   - Status on sales lines → ALLOCATED.
   - Outbox: `stock.reserved`, `order.allocated`.
4. Warehouse tile (same or split view) sees live inventory reduction via SSE.
5. `order.fulfillShip` (pick/pack/ship action):
   - Move reserved → shipped in ledger (status accounts).
   - Write Fulfillments 017 row (fulfillment_id, order_id, status SHIPPED, carrier, tracking, product refs).
   - Update sales status → SHIPPED.
   - Ledger: COGS (inventory asset credit + expense debit at standard_cost), AR (debit customer AR, credit revenue + tax_liability).
   - Outbox: `fulfillment.shipped`, `order.fulfilled`, `ar.posted`.
6. Later: `payment.record` or `invoice.create` (further money movements).

**Procurement Workflow (PO → Receive → Stock)**
1. Procurement View: `purchaseOrder.create` (flattened in 016).
2. `purchaseOrder.receive`:
   - For lines: write qty_received, update status.
   - `inventory.adjust` (+qty) or direct cell + ledger stock_receive.
   - Basic 3-way: compare vs PO qty/price (tolerance or variance flag).
   - Batch groups PO + Inventory by product+wh.
3. Inventory tile live-updates.

**Maintenance / Transfers / Returns**
- `inventory.adjust` (negative for issues, positive for receipts/adjusts; always through ledger).
- Return: `order.return` + `inventory.returnReceipt` (reverse stock + money; option to quarantine vs restock).
- Cycle count: dedicated command that adjusts on_hand to match physical count via ledger.

All steps are single commands (or small orchestrated sequences inside one handler for atomicity) so that the tx + batch + ledger + outbox are consistent.

## 4. How Business Logic Synergises with Backend and Frontend Elements

**Backend synergy:**
- Every workflow step = one (or few) `CommandHandlerBase` executions inside the atomic Boundary B tx (cells writes via `context.tx.query`, ledger via `context.ledger.createTransfer`, outbox inserted by processor).
- `batch-partition-policy.yml` + `compilePartitions` (Union-Find on partitionKeys/FKs/formulaRefs/custom rules) ensures that a command touching multiple rows/workbooks (e.g. multi-line fulfill across products) is grouped into connected components for tx safety. Custom rules (qty >=0) run at partition time.
- Ledger participation for all conserved quantities (stock statuses, AR, COGS, cash) — exactly as required by `ledgerability-classification.md`.
- Outbox events are the live-update bridge: a fulfill command in Sales view updates Inventory and Fulfillments tiles via SSE without polling the whole universe.
- RLS/tenant filters + command_log correlation (AUD-001) apply uniformly.
- RetrievalRevalidator (future) can be used for derived-plane projections over these cells without bypassing command boundary.

**Frontend synergy (spreadsheet-native + tiled):**
- Views are **presets over the existing TiledWorkspace** (array of tiles with type+workbookId). User can still split, swap workbooks, add ad-hoc grids, edit via trailing empty row or direct cell (for non-protected columns).
- Relations graph (`WorkbookGraph`, edges from workspace + semantic labels) becomes the "view navigator": click to focus or "add related tile" (e.g. from order select the product's inventory tile).
- TransposedDetail is perfect for master-detail inside a view (select line → see full order + actions).
- SpreadsheetGrid (dynamic cols, keyboard nav, type-to-edit, sum footers, optimistic borders via `commandStates`) is used for every grid tile.
- Domain command submission (via `commandClient` or direct) from within tiles (buttons in detail toolbar, context menu on selected rows, or special action columns like "[Allocate]") produces optimistic state that appears in all affected tiles.
- SSE subscription (already per-workbook in page.tsx) + view-level subscription can refresh exactly the tiles in the open view on relevant domain events.
- ExplorerPanel already computes related workbooks from edges — perfect for suggesting tiles to add to current view.
- Optimistic UI + ambiguity handling (pending yellow → committed green or refresh-required) works across the multi-tile view because command states are keyed by cell.

**Cross-tile reactivity without magic:**
- A command always writes to the cells of the workbooks it affects.
- Outbox events carry the primary workbook + enough payload (orderId, productIds) for clients to decide which tiles to refresh or highlight.
- No need for full tiled workspace runtime changes in Phase 0 — the existing split + global selection + SSE already provide the substrate.

## 5. Alternatives Considered & Synergy Evaluation

We evaluated along two axes (business logic style × view/tile organization) plus cross-cutting dimensions.

### 5.1 Business Logic Styles

**A. Pure Cell / Spreadsheet-Driven**
Users (or UI wizards) directly `cell.update` status, qtys, totals. Formulas or background jobs derive available etc.

**B. Coarse Domain Commands (Recommended base)**
Only domain commands for workflow steps; cells for ad-hoc + master data.

**C. Hybrid (cells for masters + light commands; client orchestration for sequences)**
Commands for atomic pieces; client glues them.

### 5.2 View / Tile Organization

**X. Fully Dynamic User Tiling (current baseline)**
No presets; user builds everything from explorer + splits.

**Y. Static Locked Screens per Workflow**
One fixed layout per "module" (no split, no extra grids).

**Z. View Presets + User Extensibility (Recommended)**
Named presets load good defaults; user can still split/customize/add tiles.

### 5.3 Synergy Matrix (selected dimensions)

| Dimension | A+X (pure cell + dynamic) | B+Z (domain cmds + presets) | C+Y (hybrid + static) | Notes on Synergy |
|-----------|---------------------------|-----------------------------|-----------------------|------------------|
| Backend tx + batch atomicity | Weak (many small cell.updates; no natural grouping) | Excellent (one command = one tx; batch policy partitions multi-wb/line mutations) | Medium | B+Z directly uses `compilePartitions` + handler tx boundary. |
| Ledger for conserved quantities | Poor (manual or bypassed) | Excellent (every handler must go through NumericLedgerPort) | Good | Matches `ledgerability-classification` and contract. |
| Outbox / live cross-tile reactivity | Noisy (per-cell events) | Clean (semantic `stock.reserved`, `order.fulfilled` events) | Medium | Enables SSE updates to exactly the tiles in an open view. |
| Frontend TiledWorkspace + grid | Good (fits perfectly) | Excellent (presets are just initial tile arrays over the same component) | Poor (static loses the split/grid power) | Z builds on existing `TiledWorkspace`, `SpreadsheetGrid`, graph. |
| Spreadsheet-native feel (empty row, dynamic cols, ad-hoc edit) | Excellent | Good (cells still available; domain cmds feel like "smart buttons" on the sheet) | Weak | Avoids turning into forms. |
| Invariant enforcement (stock non-neg, 3-way, status) | Weak (user can break) | Strong (centralized in handlers + customDomainRules) | Medium | Phase 0 requirement. |
| Relations graph + explorer synergy | Low (just navigation) | High (graph drives "add related tile" inside the business view) | Low | Graph becomes part of the workflow UX. |
| Implementation cost / Phase 0 fit | Low | Medium (extend existing handlers + add presets) | High (would require new locked UI) | Fits current CommandHandlerBase, outbox, cells, Tiled. |
| Future evolution (structured tables, RetrievalRevalidator, more tiled) | Hard (inconsistent state) | Good (commands produce clean events/cells) | Medium | Aligns with post-MVP planes and schema playbook. |

**Winner: B + Z (Domain commands + View Presets + user extensibility)** — highest synergy across the board while respecting "spreadsheet-native" and all Phase 0 non-negotiables.

**Other alternatives evaluated (lower scores):**
- Full event choreography (handlers only emit; no central tx) → loses atomicity guarantees of current processor.
- Client-side only orchestration of cell updates → noisy outbox, bypasses ledger/batch.
- Purely static views → violates dynamic tiled model and spreadsheet flexibility.
- Separate "header" + "line" workbooks with virtual multi-wb grids → adds cross-wb query complexity before we have proper projections (Phase 0 prefers flattened + client grouping).

## 6. Recommended Next Steps & Rollout Notes

1. Extend the handler set (add allocate, fulfillShip, receive, return, cycleCount) following the existing Inventory/SalesHandlers patterns + mandatory invariants/ledger threading.
2. Add `viewPresets` (or equivalent) in the web app and a simple switcher (builds on existing module tabs / ALLOWED_WORKBOOKS).
3. Enhance relations graph and ExplorerPanel to support "Add to current view" for related workbooks.
4. Ensure all new commands emit the right semantic outbox events with partition keys so multi-tile views stay live.
5. Update batch policies (already partially done) and add test fixtures that exercise full workflows.
6. Document in UI the distinction between ad-hoc cell edit and "business action" (e.g. visual treatment or tooltips).
7. Staged rollout after vertical slice: start with Master Data + Sales Ops views; add others as handlers mature.

**Risks & Mitigations:**
- Users still able to break data via direct cell edit on protected columns → UI guidance + future protected-column logic in generic cell handler (or field policy).
- View presets become stale if workbooks change → presets are data-driven from ALLOWED + edges where possible.
- Multi-wb commands grow complex → rely on batch partition compiler + small handler surface.

This spec deliberately stays within existing primitives (CommandHandlerBase + cells + outbox + TiledWorkspace + batch policies) while providing a clear path for integrated business workflows that feel native to the spreadsheet UI.

## References
- Prior domain model spec and critical review (data model, flattened choice, meta convention, action integration, cross-tile reactivity).
- `docs/dev/batch-partition-policy.md`, command lifecycle, numeric ledger contract, ledgerability classification.
- UI spec (dynamic columns, empty row, tiled, transposed, graph).
- AGENTS.md / Phase 0 boundaries (command-first, outbox polling, no forbidden tech, canonical data contracts).

All diagrams and concrete code sketches can be added in follow-on PRs once the logical model is agreed.