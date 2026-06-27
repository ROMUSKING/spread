---
version: "0.17.0"
last-reviewed: "2026-06-27"
status: "Approved baseline"
---

# Pilot Dataset Definition

## Purpose

Define repeatable datasets for vertical-slice tests and Phase 0 benchmarks. Dataset names must appear in benchmark output and CI evidence.

## Datasets

| Dataset | Purpose | Scale |
|---|---|---:|
| `pilot-v1-small` | Vertical slice and command/outbox correctness tests. | 1 tenant, 5 users, 3 workbooks, 200 products, 1k SKU/location rows, 10k historical outbox rows. |
| `pilot-v1-10k` | Batch partition and polling load tests. | 10 tenants, 50 users, 50 workbooks, 10k editable row mutations, 100k historical outbox rows. |
| `pilot-v1-cardinality` | RLS/query-plan tests. | Low/median/high user-scope cardinality fixtures. |

## Minimal domain fixture

The first safe cell edit should use inventory because it exercises realistic dependencies without financial posting risk.

```text
Tenant -> Workbook(inventory_control)
Product(id, sku, standard_cost)
Warehouse(id)
StockBalance(product_id, warehouse_id, quantity_on_hand)
StockReservation(product_id, warehouse_id, reserved)
Editable projection: Available = quantity_on_hand - reserved
Safe cell edit: update StockBalance.quantity_on_hand for one product/warehouse
```

## Acceptance data requirements

- Every fixture row has deterministic IDs.
- Fixture generation records seed, git SHA, PostgreSQL version, Node.js version, and machine profile.
- Outbox historical rows include at least one retention-gap scenario.
- Dataset contains at least one row the test user may edit and one row the test user must not see.
- Dataset contains no regulated or real customer data.

## Evidence URIs

- `dataset://pilot-v1-small`
- `dataset://pilot-v1-10k`
- `dataset://pilot-v1-cardinality`
- `ci://tests/data/pilot-dataset-shape`

## Ecommerce + Owned Warehouse Logical Workbooks (Phase 0 canonical contracts)

This subsection (together with extensions in `numeric-ledger-contract.md`) serves as the Phase 0 canonical source for *logical* data table / workbook contracts in the SME online ecommerce + owned warehouse domain. Physical storage remains `current_cell_values` (see migration 0001 and `current_cell_values` queries in server.ts). No DDL is introduced here.

See also: `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md` (full rationale, alternatives, synergy matrix, command payloads, ledger movement_kinds, and PR plan).

**Deterministic workbook UUIDs (use exactly these):**
- Products: 00000000-0000-0000-0000-000000000010
- Customers: 00000000-0000-0000-0000-000000000011
- Suppliers: 00000000-0000-0000-0000-000000000012
- Warehouses: 00000000-0000-0000-0000-000000000013
- InventoryBalances: 00000000-0000-0000-0000-000000000014 (evolves pilot ...003 "Inventory Stock")
- SalesOrders: 00000000-0000-0000-0000-000000000015 (evolves pilot ...002 "Sales Orders")
- PurchaseOrders: 00000000-0000-0000-0000-000000000016
- Fulfillments: 00000000-0000-0000-0000-000000000017

**Row ID conventions (for current_cell_values row_id):**
- Products: `PROD-0001` or `p1`
- Inventory row: `${productId}:${warehouseId}` (e.g. `p1:w1`)
- Sales line: `${orderId}-L${seq}` (e.g. `SO-001-L1`); optional `${orderId}-HDR` for order header summary row
- PO line: `${poId}-L${seq}`
- Fulfillment: `${fulfillmentId}` or `${orderId}-F1`

**Key logical columns (value_text storage; discovered dynamically; use id refs not item_name):**

Products:
- product_id, sku (partition), name, unit_price, cost / standard_cost (for COGS), tax_rate, weight_kg, reorder_point, active

InventoryBalances (partition on productId + warehouseId):
- product_id, warehouse_id, quantity_on_hand (ledgerable), quantity_reserved (ledgerable), quantity_available (command-derived), bin_location, reorder_point, status

SalesOrders (partition on orderId; flattened lines recommended):
- order_id, line_id (or per line row), product_id, sku (denorm), customer_id, qty, unit_price, line_total, tax_amount, tax_rate_snapshot, status (DRAFT|CONFIRMED|ALLOCATED|SHIPPED|...), 

PurchaseOrders / Fulfillments: analogous (po_id / fulfillment_id, supplier refs, received/shipped qtys, status).

**Batch partition policies:** See `workbooks/*/batch-partition-policy.yml` (productId+warehouseId for inventory/stock; orderId for sales; modeled on existing inventory example using `compilePartitions`).

**Ledger integration (conserved only):** Stock status accounts (available/reserved/shipped) and money (AR, revenue, COGS using standard_cost at fulfill time, cash). See numeric-ledger-contract extension.

**Minimal extended fixture example:**
```text
Products, Warehouses, Customers, Suppliers (masters)
InventoryBalances(product_id, warehouse_id, quantity_on_hand, quantity_reserved)
SalesOrders(order_id, product_id, qty, unit_price, tax_amount, status, customer_id)
Derived in command: available = on_hand - reserved; line_total = qty * unit_price; tax via snapshot rate.
```

Update scales for pilot-v1-ecom: 1 tenant, ~50 products, 200 inventory rows, 100 orders across the 8 logical workbooks.

All fixtures use deterministic IDs. Update `pilot-dataset-shape` evidence when ecom seeds are added.
