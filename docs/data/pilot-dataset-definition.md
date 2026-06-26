---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
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
