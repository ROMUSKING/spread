# SME Ecommerce Business Applications Audit & Design Spec

**Document ID:** SPEC-BUS-APPS-AUDIT-001  
**Title:** Audit of Existing Business Applications (View Presets) and Design of Most Commonly Used Ones for SME Online Ecommerce with Own Warehouse  
**Version:** 0.17.1  
**Date:** 2026-06-28  
**Status:** Approved  
**Related:** 
- `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md`
- `docs/data/sme-ecommerce-business-logic-and-tile-views-spec.md`
- `docs/data/sme-extended-variants-and-entities-spec.md`
- `apps/web/src/components/TiledWorkspace.tsx` (VIEW_PRESETS)
- `apps/api/src/commands/handlers/*`
- AGENTS.md / Phase 0 constraints

## 1. Executive Summary

This spec audits the current "business applications" implemented as `ViewPreset` tile groupings in the Spreadsheet-Native ERP UI. It identifies the most commonly used applications for a typical SME online ecommerce company operating its own warehouse. New presets are designed and implemented to fill gaps. All designs prioritize deep synergy with:

- **Frontend**: TiledWorkspace (grid/detail/explorer/graph tiles), dynamic column discovery, trailing empty row entry, keyboard navigation, relations graph, transposed detail, SSE live updates, optimistic command states, split layouts.
- **Backend**: Command-first mutations (`CommandHandlerBase`), `current_cell_values` storage with id-based cross-links, NumericLedgerPort (stock/money), batch partition policies for atomic multi-row/multi-wb tx, outbox polling for cross-"app" reactivity, RLS/tenant isolation.

**Audit Findings (Current State):**
- 4 existing presets (Master Data, Sales Processing (OTC), Warehouse Ops, Procurement (PO)).
- These cover core flows but are incomplete for high-volume ecomm ops (e.g., no dedicated customer history/CRM view, no returns, limited financials).
- Rely on the 8+ ecom workbooks (010-017 + extended 021,025,026 etc.) + pilot.
- Business logic partially stubbed in handlers (productTemplate.create, salesOrder.create, inventory.adjust, MasterData handlers); many workflows still rely on cell edits or incomplete.

**New Applications Created (Most Common):**
1. **Customer Management** - High frequency for order history, support, data maintenance.
2. **Returns Management** - Ecomm-typical (10-30% return rates); critical for inventory accuracy and customer satisfaction.
3. **Financials & Invoicing** - Ties sales/purchasing to ledger for cash flow, AR/AP basics.

These are added to `VIEW_PRESETS` with sensible tile groupings using cross-linked data.

**Alternatives Considered:**
- Monolithic single-view "ERP Dashboard".
- Separate top-level "Apps" (non-tiled).
- Fully dynamic/no presets (status quo base).
- AI/context-driven dynamic tiling.
Evaluation matrix shows preset + tiled + command-driven wins for Phase 0 synergy (see section 5).

**Workflow Modeling:** Each new app models end-to-end from master data creation (product/customer/supplier) through operations (sales, PO, fulfill), transfers (stock moves, returns), and maintenance (adjustments, cycle counts). All via commands that update cells + ledger atomically and emit outbox events for multi-tile/app live sync.

All changes respect Phase 0: no new DDL (use/extend cells), commands only for mutations, outbox polling default, batch for tx grouping, no TigerBeetle etc.

## 2. Audit of Existing Business Applications

### 2.1 Current Implementation (as of audit)
Business "applications" are realized as `ViewPreset` objects in `TiledWorkspace.tsx`:
- Rendered via a "Preset Views:" `<select>` dropdown that calls `applyPreset()`.
- Each preset defines an array of `TileState` (type + workbookId + optional gridArea for layout).
- Layout: row/column split.
- Synergizes with global state (workbookRows/Columns from SSE), `onCellEdit`, graph, etc.
- Backed by `ALLOWED_WORKBOOKS` (synced across web/api), seeds in `postgres.ts` (InMemory + migration 0002), handlers in `commands/handlers/`.

**Existing Presets:**

1. **Master Data**
   - Tiles: explorer + grid + graph on 000...021 (ProductTemplates from extended spec).
   - Purpose: Catalog maintenance.
   - Gaps: Does not prominently include Customers (011), Suppliers (012/025), Addresses (026), or base Products (010). Uses templates/variants focus but master data is broader.

2. **Sales Processing (OTC - Order to Cash)**
   - Tiles: SalesOrders grid (015), InventoryBalances grid (014), detail on 015.
   - Good synergy: Side-by-side order + stock for allocation decisions. Uses flattened lines per prior spec.
   - Commands: Leverages `salesOrder.create`; stubs for confirm/allocate/fulfill.

3. **Warehouse Ops**
   - Tiles: InventoryBalances grid (014) + graph.
   - Focus: Stock visibility and adjustments.
   - Commands: `inventory.adjust`.
   - Strong use of batch policy (productId + warehouseId partitions).

4. **Procurement (PO)**
   - Tiles: PurchaseOrders grid (016), Suppliers extended grid (025), detail on 016.
   - Covers PO creation/receiving basics.
   - Commands: Limited; needs `purchaseOrder.receive` expansion.

**Other Supporting Elements (not full "apps" yet):**
- Pilot modules: Sales Orders (002), Inventory Stock (003), Purchase Ledger (004) - still referenced in defaults.
- Extended: Product Variants (022), Parties/Customers/Suppliers unified (023), Addresses (026) per `sme-extended-variants-and-entities-spec.md`.
- Handlers: MasterDataHandlers (templates, parties, addresses, suppliers), Sales/Inventory stubs.
- Data: Cross-linked seeds (e.g., sales lines ref product_id + customer_id; inventory `${product}:${warehouse}`; outbox events for reactivity).
- UI Synergy: SSE updates multiple tiles; graph shows cross-app edges (e.g., sales -> inventory); transposed for editing; optimistic states per command.

**Gaps Identified:**
- No dedicated customer-centric view (ecomm ops often start from customer/order history).
- Returns not represented (common pain point; affects inventory + ledger + customer).
- Financials fragmented (Purchase Ledger 004 exists but no integrated AR/invoicing view with sales).
- Limited fulfillment/shipping separation from sales processing.
- No explicit "end-to-end" app for maintenance/transfers.
- Presets are basic (no default actions wired to commands yet; rely on cell or future UI buttons).
- Some workbooks (e.g. 011 Customers, 017 Fulfillments) under-used in presets.
- Synergy issues: Presets don't always span related workbooks for live updates (e.g., sales change doesn't auto-surface in inventory tile unless manually added). Batch policies exist but not all workflows use multi-wb commands.

**Frequency Rationale (for SME online ecomm + own warehouse):**
Based on typical ops (Odoo/NetSuite/ShipStation research for similar scale):
- Inventory/Warehouse: Daily (stock checks, picks, receives) - 40%+ time.
- Order/Sales Processing: High volume, multiple per day.
- Procurement: Replenish 1-5x/week.
- Master Data: Ongoing but lower volume.
- Customer Mgmt: High for support, repeat buys.
- Returns: 5-30% of orders; high impact.
- Financials: Weekly reconciliation, daily payments.

## 3. Most Commonly Used Business Applications (New/Enhanced)

We audited against common SME ecomm+warehouse needs and created/enhanced the following as first-class presets. All use existing workbooks where possible, id-based cross-links, and are designed for command-driven logic.

### 3.1 Customer Management (New - High Priority)
**Rationale:** Most customer interactions (order lookup, updates, support) happen here. Synergizes customer data with sales history.

**Tile Grouping (row layout for side-by-side history):**
- Grid: Customers (011)
- Grid: Addresses (026) - linked via party_id
- Grid: SalesOrders (015) - for order history (filterable in future by customer_id)
- Detail: Transposed on selected customer
- Graph: Relations (customer -> orders, addresses)

**Key Workflows Modeled:**
- Create/Edit Customer -> Party create (unified) + address + asCustomer details. Command: `party.create` or `customer.create` (extends MasterDataHandlers).
- View History: Select customer -> SalesOrders tile auto-refreshes via SSE on `salesOrder.*` events.
- Update Credit/Status -> Cell edit or command; affects future sales.
- From here, "Create Order for Customer" action -> pre-fills salesOrder.create with customerId.

**BE Synergy:**
- Commands write cells in 011/026/015.
- Outbox events (e.g. from sales) update all tiles in view.
- Batch policy on customer_id for customer-related mutations if multi-wb.

**FE Synergy:**
- Graph shows links; click to focus sales tile.
- Detail for editing; grid for list + trailing row for new.
- Live: Order placed elsewhere updates customer view.

### 3.2 Returns Management (New - Ecomm Critical)
**Rationale:** Returns are frequent; must quickly restock or quarantine, credit customer, update ledger.

**Tile Grouping:**
- Grid: Fulfillments (017) - filter for "returned" status
- Grid: SalesOrders (015) - original order
- Grid: InventoryBalances (014) - for restock impact
- Detail: On selected return/fulfillment
- Graph: Links (return -> original order -> inventory)

**Key Workflows:**
- Receive Return (from customer/fulfillment) -> Update fulfillment status, trigger `inventory.returnReceipt` (or adjust + ledger reverse).
- Restock or Quarantine: Command updates inventory cells + status account in ledger.
- Credit: `payment.record` or AR credit in ledger; update sales status.
- Full: Command sequence ensures atomic (via batch on order/product/wh) + outbox for inventory/sales tiles to refresh.

**Synergy:**
- BE: Uses ledger for reverse stock/money (per ledgerability). Batch groups inventory + sales.
- FE: Multi-grid view shows before/after impact live via outbox. Graph for traceability. Actions in detail tile.

### 3.3 Financials & Invoicing (New)
**Rationale:** Ties everything to cash (AR from sales, AP from PO, COGS, payments). Common for owner to review daily/weekly.

**Tile Grouping:**
- Grid: Purchase Ledger (004) - for AP/invoices
- Grid: SalesOrders (015) - for AR potential (or extend with invoice workbook)
- Detail: On ledger entry
- Graph: Financial relations (order -> ledger entries)

**Workflows:**
- Post Sale Invoice -> From fulfill, command posts AR/revenue (ledger transfers).
- Receive Payment -> `payment.record` updates ledger + cells.
- Reconcile PO: Link to 016.
- Maintenance: Adjustments via commands affecting ledger.

**Synergy:**
- Leverages existing 004 + sales data.
- Commands ensure ledger + cells consistent.
- Outbox for "financial event" updates views.
- Tiled allows side-by-side ledger + orders for quick review.

### 3.4 Enhancements to Existing
- **Master Data:** Expand preset to include 011 Customers + 025 Suppliers + 026 Addresses + 010/021/022 Products/Variants (multi-grid or tabs via extra splits).
- **Sales Processing:** Add Fulfillments tile for full OTC visibility.
- **Warehouse/Procurement:** Add command action surfaces (future UI buttons calling e.g. `inventory.adjust`).

## 4. Synergy with Frontend and Backend

**Frontend Synergy (Spreadsheet-Native + Tiled):**
- Presets load directly into `TiledWorkspace` using existing `applyPreset`, `TileState`, gridArea for layouts.
- All tiles benefit from dynamic columns (from cells), trailing empty row (ad-hoc entry), keyboard nav, type-to-edit, sum footers, optimistic overlays (via commandStates), SSE (multi-workbook subscriptions already in page.tsx).
- Graph/Explorer provide cross-app navigation (e.g., from customer view jump to inventory).
- Transposed detail for focused record work within app.
- Live reactivity: Outbox events from one command (e.g. return affecting 3 workbooks) update all tiles in the preset view without full refresh.
- Alternatives considered: See below. This maximizes existing components without full tiled workspace changes.

**Backend Synergy (Command-First, Cells, Ledger, Outbox, Batch):**
- All app actions route through registered commands (e.g. `customer.update`, `inventory.returnReceipt`, `salesOrder.fulfill`).
- Handlers do tx writes to multiple workbooks' cells + `ledger.createTransfer` where valuation/stock conserved.
- Batch policies group (e.g. Returns command partitions on order_id or product+wh to keep atomic).
- Outbox events (with workbook/partition_key) enable targeted SSE to tiles across "apps" (e.g., inventory change from returns view updates warehouse ops preset if open).
- Data model (id refs from prior specs) enables natural linking in graph and queries.
- No bypass: Direct cell edits possible but discouraged for business flows (UI can gate or log).

**Cross-Cutting:**
- Commands emit events usable by any view.
- Seeds (from prior) provide demo data with links for all new presets.
- RLS/allowlists apply uniformly.

## 5. Alternatives Considered

**A. Monolithic "Operations Dashboard" View**
One giant preset with 6+ tiles for everything.
- Pros: Always see full picture.
- Cons: Cluttered, poor on small screens, violates "focus" ; hard to maintain batch tx scope.
- Synergy: Weak with tiled (overloads one workspace); backend events would overwhelm.

**B. Separate Top-Level "Apps" (non-tiled, like traditional ERP modules)**
E.g., dedicated pages or full-screen for "Customers App" outside Tiled.
- Pros: Deep focus, traditional UX.
- Cons: Loses spreadsheet-native (side-by-side grids, graph integration); duplicates SSE/state code; breaks current dynamic model.
- Synergy: Poor with frontend (Tiled, graph as unifier); backend commands still work but UI loses live cross-app feel.

**C. Purely Dynamic (no or minimal presets)**
Keep only pilot defaults + manual assembly via explorer/split.
- Pros: Maximum flexibility.
- Cons: Steep learning curve for common flows; users miss integrated views; no guidance for business processes.
- Synergy: Good baseline but low for "commonly used" productivity.

**D. AI/Context-Aware Dynamic Grouping**
On-the-fly suggest/add tiles based on selected row or user role.
- Pros: Smart, adaptive.
- Cons: Unpredictable in Phase 0; hard to test; may bypass user intent; requires more state mgmt.
- Synergy: Future interesting, but current outbox + manual graph is sufficient and more predictable.

**E. Command-Driven Views (recommended base + enhancements)**
Presets as starting points + commands as the "glue" (actions in tiles update related tiles via outbox/batch).
- Pros: Strong spreadsheet feel + guided business logic; reuses all existing (Tiled splits + commands + cells + outbox + batch + ledger + graph).
- Cons: Requires good preset curation.
- Evaluation vs others: Highest synergy scores (see matrix in business-logic-and-tile-views-spec.md for similar). Backend: commands centralize logic/invariants/ledger. Frontend: tiles remain native spreadsheets; presets enhance without replacing. Live updates make "multi-app" feel integrated. Scalable to more workbooks.

**Recommendation:** E + current presets mechanism. Add the new ones above. For actions, surface domain commands (e.g. via future "Actions" column or buttons calling commandClient.submit) rather than pure cells for business flows.

## 6. Documented Workflows for New Apps

**Customer Management Workflow Example:**
1. Open preset -> Grid on Customers (011).
2. Create: Use trailing row or command `party.create` (asCustomer) -> writes cells, optional address.
3. View/Act: Select -> loads SalesOrders tile (via graph or manual) + detail. History visible via linked data.
4. Update: Cell edit or `customer.update` command -> outbox updates any open sales/returns views.
5. From here: "New Order" action pre-populates `salesOrder.create` with customerId.

**Returns Management Workflow:**
1. Receive return (e.g. via fulfillment update or new return row).
2. Command `inventory.returnReceipt` or `order.return` + adjust: Updates fulfillment status, inventory cells (restock/quarantine via ledger reverse), sales status, customer credit.
3. Batch policy groups on relevant keys.
4. Outbox events: `return.received`, `stock.returned` -> live update inventory + sales tiles in other open views.
5. Maintenance: Cycle count command to reconcile.

Similar for others. All start from master data creation (product/customer/supplier via commands) -> operational commands -> transfers (returns, adjustments) -> maintenance.

See `sme-ecommerce-business-logic-and-tile-views-spec.md` for full command sequences and diagrams.

## 7. Implementation & Rollout Notes

- **Code Changes:** Added 3 new presets to `VIEW_PRESETS`. Fully implemented the backend handlers for `inventory.returnReceipt` and `payment.record`. Registered the handlers in `server.ts` and wired the corresponding action forms inside `BusinessCommandCenter.tsx` and `page.tsx` on the client.
- **Handlers:** Implemented `InventoryReturnReceiptHandler` (increases `quantity_on_hand` and `quantity_available` in workbook 014, records return line in workbook 017, posts `stock_return` ledger transfer) and `PaymentRecordHandler` (creates payment row in workbook 004, updates sales status to `INVOICED` in workbook 015, posts `cash_received` ledger transfer).
- **UI Enhancements:** Form inputs and action cards for processing returns and recording payments have been wired to the command submission route in `BusinessCommandCenter.tsx` and `page.tsx`. Added **Native Resizable Tiles** inside `TiledWorkspace.tsx` utilizing pointer capture. Smooth drag dividers are styled dynamically in `globals.css`.
- **Synergy Enablers:** Commands emit outbox events for cross-preset reactivity. Batch policies ensure tx safety when one command touches multiple "apps'" workbooks.
- **Phase 0 Compliance:** Everything via commands/cells/outbox/batch. Presets are UI sugar.
- **Testing:** Added complete integration and unit test coverage in `tests/evidence.test.mjs` verifying the new commands and their ledger side effects, and automated smoke tests in `apps/web/test/smoke.test.mjs` verifying the resizable dividers, pointer event capture handlers, and styles.
- **Staged:** Fully completed Customer, Returns, and Financials preset support. All allowed sync comments are fully satisfied.
- **Alternatives in Code:** Presets vs pure dynamic (both supported).

## 8. Open Questions & Future

- Wire explicit command buttons per preset (vs cell-only)?
- Per-user saved views or role-based defaults?
- How to handle "sub-views" within large apps (e.g. tabs inside grid tile)?
- Full multi-warehouse support (current assumes one).
- Integration with future analytics plane for "Financials" reporting.

All designs evaluated for synergy; chosen approach maximizes reuse of existing Phase 0 elements while delivering common SME business apps.

(End of spec. See related docs for data models, logic details, and seeds supporting these apps.)