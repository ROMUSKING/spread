---
version: "0.18.0"
last-reviewed: "2026-06-27"
status: "Approved"
---

# Extended Data Schema & Business Logic: Customers, Suppliers, Products & Variants

**Document ID:** SPEC-DOMAIN-EXT-001  
**Title:** Extended Master Data Schema & Product Variant Modeling  
**Version:** 0.17.0  
**Status:** Approved  
**Audience:** Implementers, QA, Platform, and Frontend Teams  

## 1. Executive Summary

This document specifies the logical schemas, business logic, and backend/frontend integrations for extending Spreadsheet-Native ERP's core master data: Customers, Suppliers, Product Templates, Product Variants, and Addresses.

Based on industry research (SAP, NetSuite, Odoo), the design utilizes a **Normal Relational Split (Approach 2)** modeled logically inside the cell-based `current_cell_values` facade. This balances strict relational integrity with spreadsheet flexibility.

---

## 2. Logical Workbook Schemas

New workbooks are assigned deterministic UUIDs and link via cell-stored foreign keys (`product_id`, `template_id`, `party_id`).

### 2.1 Product Templates (00000000-0000-0000-0000-000000000021)
Holds generic attributes shared across variants to prevent data drift.
- `template_id` (TEXT, PK, e.g., `TMP-001`)
- `name` (TEXT, required)
- `description` (TEXT)
- `category` (TEXT)
- `base_price` (NUMERIC)
- `base_cost` (NUMERIC)
- `default_tax_rate` (NUMERIC)

### 2.2 Product Variants (00000000-0000-0000-0000-000000000022)
Represents the stockable/sellable SKU.
- `product_id` (TEXT, PK, SKU, e.g., `PROD-DESK-PREM-RED-L`)
- `template_id` (TEXT, FK references Product Templates)
- `option_color` (TEXT, e.g., `Red`)
- `option_size` (TEXT, e.g., `L`)
- `price_delta` (NUMERIC, added to `base_price` to compute unit_price)
- `cost_delta` (NUMERIC, added to `base_cost` to compute standard_cost)
- `active` (ENUM 'Y'|'N')

### 2.3 Parties (00000000-0000-0000-0000-000000000023)
Unifies contact metadata. An entity can exist as both a customer and supplier without duplicating contact profiles.
- `party_id` (TEXT, PK, e.g., `PRTY-001`)
- `legal_name` (TEXT, required)
- `tax_id` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)

### 2.4 Customers (00000000-0000-0000-0000-000000000024)
Extends Parties with customer-specific attributes.
- `customer_id` (TEXT, PK, e.g., `CUST-001`)
- `party_id` (TEXT, FK references Parties, unique)
- `credit_limit` (NUMERIC)
- `payment_terms` (TEXT, e.g., `NET30`)

### 2.5 Suppliers (00000000-0000-0000-0000-000000000025)
Extends Parties with supplier-specific attributes.
- `supplier_id` (TEXT, PK, e.g., `SUPP-001`)
- `party_id` (TEXT, FK references Parties, unique)
- `lead_time_days` (NUMERIC)
- `payment_terms` (TEXT)

### 2.6 Addresses (00000000-0000-0000-0000-000000000026)
Enables multiple shipping/billing addresses per party.
- `address_id` (TEXT, PK, e.g., `ADDR-001`)
- `party_id` (TEXT, FK references Parties)
- `address_type` (ENUM `BILLING`|`SHIPPING`)
- `street` (TEXT)
- `city` (TEXT)
- `postal_code` (TEXT)
- `country` (TEXT)

---

## 3. Business Logic Commands & Invariants

All mutations go through registered handlers in `command_api` and participate in a single transaction (Boundary B).

### 3.1 Command Payloads

```ts
export interface ProductTemplateCreatePayload {
  name: string;
  description?: string;
  category?: string;
  basePrice: string;
  baseCost: string;
}

export interface ProductVariantCreatePayload {
  templateId: string;
  options: { color?: string; size?: string; style?: string };
  priceDelta: string;
  costDelta: string;
}

export interface PartyCreatePayload {
  legalName: string;
  taxId?: string;
  email?: string;
  phone?: string;
  asCustomer?: { creditLimit: string; paymentTerms: string };
  asSupplier?: { leadTimeDays: number; paymentTerms: string };
}
```

### 3.2 Key Invariants

1. **Credit Limit Check**:
   - `salesOrder.confirm` must query the Customer record and calculate the current AR balance + order total. If it exceeds `credit_limit`, transition is rejected.
2. **Referential Integrity**:
   - Creating a `ProductVariant` requires the referenced `template_id` to exist in `ProductTemplates`.
   - Creating a `Customer` or `Supplier` requires the `party_id` to exist in `Parties`.
3. **No Negative Deltas**:
   - `price_delta` and `cost_delta` may be negative, but `base_price + price_delta` and `base_cost + cost_delta` must remain greater than or equal to zero.

---

## 4. Backend and Frontend Integrations

### 4.1 Union-Find Batch Compilation
- The `BatchPartitionPolicy` compiler uses connected components to group mutations.
- The policy rules for variants declare `template_id` as a `foreignKey` linking `ProductVariants` to `ProductTemplates`.
- Updates to `ProductTemplates` trigger recompilation of all connected components sharing the same `template_id`.

### 4.2 Frontend Virtual Grid Joins
- The frontend `SpreadsheetGrid` reads metadata to merge related workbooks.
- Instead of showing raw IDs, it joins `ProductVariants` with its parent `ProductTemplates` to present a unified editable grid with columns: `SKU`, `Name (from Template)`, `Color`, `Size`, `Total Cost (cost + delta)`, `Total Price (price + delta)`.
- Direct cell updates to virtual fields (like `Name`) are routed to `product.updateTemplate` commands, while SKU-level updates (like `Color`) route to `product.updateVariant`.
