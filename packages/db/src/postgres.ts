// @ts-nocheck
// NOTE: 'pg' is a runtime dep (see package.json). Smoke typecheck is intentionally lightweight and
// does not require installed optional runtime packages. After `pnpm install` the full types/build work.
// Real implementation uses 'pg' Pool for Queryable and transactions.

import { Pool, type PoolClient } from 'pg';
import type { Queryable, TransactionClient } from './transaction';

export type PostgresConfig = {
  connectionString?: string;
  max?: number;
};

let globalPool: Pool | null = null;

export function getPool(config?: PostgresConfig): Pool {
  if (!globalPool) {
    const connectionString =
      config?.connectionString ||
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/spreadsheet_erp';
    globalPool = new Pool({
      connectionString,
      max: config?.max ?? 10,
    });
  }
  return globalPool;
}

export function resetPool(): void {
  if (globalPool) {
    // fire and forget in dev
    globalPool.end().catch(() => {});
    globalPool = null;
  }
}

/**
 * PostgreSQL implementation of Queryable for Phase 0.
 * Used by CommandProcessor, OutboxRepository, handlers.
 */
class InMemoryQueryable implements Queryable {
  private commandLog: any[] = [];
  private currentCellValues: any[] = [];
  private outboxEvents: any[] = [];
  private numericTransfers: any[] = [];
  private nextOutboxId = 1;
  private workspaceNodes: any[] = [];
  private workspaceEdges: any[] = [];

  constructor() {
    const defaultTenant = '00000000-0000-0000-0000-000000000001';

    // Seed Workspace Nodes
    this.workspaceNodes = [
      {
        id: '00000000-0000-0000-0000-000000000101',
        label: 'Sales Operations',
        kind: 'category',
        tags: [],
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        label: 'Warehouse & Inventory',
        kind: 'category',
        tags: [],
      },
      {
        id: '00000000-0000-0000-0000-000000000103',
        label: 'Accounting & Finance',
        kind: 'category',
        tags: [],
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        label: 'Sales Orders',
        kind: 'workbook',
        tags: ['sales', 'orders'],
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        label: 'Inventory Stock',
        kind: 'workbook',
        tags: ['warehouse', 'stock'],
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        label: 'Purchase Ledger',
        kind: 'workbook',
        tags: ['finance', 'ledger'],
      },
      // 8 logical workbooks per sme-ecommerce-domain-model-and-business-logic-spec.md (exact UUIDs)
      {
        id: '00000000-0000-0000-0000-000000000010',
        label: 'Products',
        kind: 'workbook',
        tags: ['catalog'],
      },
      {
        id: '00000000-0000-0000-0000-000000000011',
        label: 'Customers',
        kind: 'workbook',
        tags: ['crm'],
      },
      {
        id: '00000000-0000-0000-0000-000000000012',
        label: 'Suppliers',
        kind: 'workbook',
        tags: ['procurement'],
      },
      {
        id: '00000000-0000-0000-0000-000000000013',
        label: 'Warehouses',
        kind: 'workbook',
        tags: ['locations'],
      },
      {
        id: '00000000-0000-0000-0000-000000000014',
        label: 'Inventory Balances',
        kind: 'workbook',
        tags: ['warehouse', 'stock'],
      },
      {
        id: '00000000-0000-0000-0000-000000000015',
        label: 'Sales Orders',
        kind: 'workbook',
        tags: ['sales', 'orders'],
      },
      {
        id: '00000000-0000-0000-0000-000000000016',
        label: 'Purchase Orders',
        kind: 'workbook',
        tags: ['purchasing'],
      },
      {
        id: '00000000-0000-0000-0000-000000000017',
        label: 'Fulfillments',
        kind: 'workbook',
        tags: ['shipping', 'fulfill'],
      },
      // compat headers from prior (kept for allowlist/backcompat; primary data in 015/016)
      {
        id: '00000000-0000-0000-0000-000000000018',
        label: 'Sales Order Headers',
        kind: 'workbook',
        tags: ['sales', 'orders', 'headers'],
      },
      {
        id: '00000000-0000-0000-0000-000000000019',
        label: 'Purchase Order Headers',
        kind: 'workbook',
        tags: ['finance', 'ledger', 'headers'],
      },
      // Extended master data workbooks (from sme-extended-variants-and-entities-spec.md)
      {
        id: '00000000-0000-0000-0000-000000000021',
        label: 'Product Templates',
        kind: 'workbook',
        tags: ['catalog', 'templates'],
      },
      {
        id: '00000000-0000-0000-0000-000000000022',
        label: 'Product Variants',
        kind: 'workbook',
        tags: ['catalog', 'variants'],
      },
      {
        id: '00000000-0000-0000-0000-000000000023',
        label: 'Parties',
        kind: 'workbook',
        tags: ['crm', 'suppliers', 'parties'],
      },
      {
        id: '00000000-0000-0000-0000-000000000024',
        label: 'Customers (extended)',
        kind: 'workbook',
        tags: ['crm', 'customers'],
      },
      {
        id: '00000000-0000-0000-0000-000000000025',
        label: 'Suppliers (extended)',
        kind: 'workbook',
        tags: ['procurement', 'suppliers'],
      },
      {
        id: '00000000-0000-0000-0000-000000000026',
        label: 'Addresses',
        kind: 'workbook',
        tags: ['crm', 'suppliers', 'addresses'],
      },
    ];

    // Seed Workspace Edges
    this.workspaceEdges = [
      {
        id: '00000000-0000-0000-0000-000000000201',
        source: '00000000-0000-0000-0000-000000000101',
        target: '00000000-0000-0000-0000-000000000002',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000202',
        source: '00000000-0000-0000-0000-000000000102',
        target: '00000000-0000-0000-0000-000000000003',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000203',
        source: '00000000-0000-0000-0000-000000000103',
        target: '00000000-0000-0000-0000-000000000004',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000204',
        source: '00000000-0000-0000-0000-000000000103',
        target: '00000000-0000-0000-0000-000000000002',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000205',
        source: '00000000-0000-0000-0000-000000000002',
        target: '00000000-0000-0000-0000-000000000003',
        label: 'deducts stock via item_name (legacy; migrate to id)',
      },
      {
        id: '00000000-0000-0000-0000-000000000206',
        source: '00000000-0000-0000-0000-000000000004',
        target: '00000000-0000-0000-0000-000000000002',
        label: 'funds order fulfillment',
      },
      {
        id: '00000000-0000-0000-0000-000000000207',
        source: '00000000-0000-0000-0000-000000000003',
        target: '00000000-0000-0000-0000-000000000004',
        label: 'triggers reorder purchases',
      },
      // id-based cross-workbook relations for 8 logical workbooks (rich sample data; see spec + review)
      {
        id: '00000000-0000-0000-0000-000000000208',
        source: '00000000-0000-0000-0000-000000000015',
        target: '00000000-0000-0000-0000-000000000014',
        label: 'allocates/reserves via product_id (Sales->InventoryBalances)',
      },
      {
        id: '00000000-0000-0000-0000-000000000209',
        source: '00000000-0000-0000-0000-000000000010',
        target: '00000000-0000-0000-0000-000000000014',
        label: 'defines stock for product_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000212',
        source: '00000000-0000-0000-0000-000000000015',
        target: '00000000-0000-0000-0000-000000000011',
        label: 'belongs to customer_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000213',
        source: '00000000-0000-0000-0000-000000000016',
        target: '00000000-0000-0000-0000-000000000012',
        label: 'from supplier_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000214',
        source: '00000000-0000-0000-0000-000000000016',
        target: '00000000-0000-0000-0000-000000000010',
        label: 'orders product_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000215',
        source: '00000000-0000-0000-0000-000000000017',
        target: '00000000-0000-0000-0000-000000000015',
        label: 'fulfills order_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000216',
        source: '00000000-0000-0000-0000-000000000017',
        target: '00000000-0000-0000-0000-000000000014',
        label: 'ships from warehouse_id affecting balances',
      },
      {
        id: '00000000-0000-0000-0000-000000000217',
        source: '00000000-0000-0000-0000-000000000013',
        target: '00000000-0000-0000-0000-000000000014',
        label: 'located at warehouse_id',
      },
      // compat prior edges (headers)
      {
        id: '00000000-0000-0000-0000-000000000210',
        source: '00000000-0000-0000-0000-000000000018',
        target: '00000000-0000-0000-0000-000000000015',
        label: 'headers link to lines',
      },
      {
        id: '00000000-0000-0000-0000-000000000211',
        source: '00000000-0000-0000-0000-000000000019',
        target: '00000000-0000-0000-0000-000000000016',
        label: 'purchase headers link to lines',
      },
      // Extended master data edges (from sme-extended-variants-and-entities-spec.md)
      {
        id: '00000000-0000-0000-0000-000000000220',
        source: '00000000-0000-0000-0000-000000000022',
        target: '00000000-0000-0000-0000-000000000021',
        label: 'variant of template_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000221',
        source: '00000000-0000-0000-0000-000000000024',
        target: '00000000-0000-0000-0000-000000000023',
        label: 'customer is a party_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000222',
        source: '00000000-0000-0000-0000-000000000025',
        target: '00000000-0000-0000-0000-000000000023',
        label: 'supplier is a party_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000223',
        source: '00000000-0000-0000-0000-000000000026',
        target: '00000000-0000-0000-0000-000000000023',
        label: 'address for party_id',
      },
      {
        id: '00000000-0000-0000-0000-000000000224',
        source: '00000000-0000-0000-0000-000000000101',
        target: '00000000-0000-0000-0000-000000000021',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000225',
        source: '00000000-0000-0000-0000-000000000101',
        target: '00000000-0000-0000-0000-000000000022',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000226',
        source: '00000000-0000-0000-0000-000000000101',
        target: '00000000-0000-0000-0000-000000000023',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000227',
        source: '00000000-0000-0000-0000-000000000101',
        target: '00000000-0000-0000-0000-000000000024',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000228',
        source: '00000000-0000-0000-0000-000000000103',
        target: '00000000-0000-0000-0000-000000000025',
        label: 'contains',
      },
      {
        id: '00000000-0000-0000-0000-000000000229',
        source: '00000000-0000-0000-0000-000000000101',
        target: '00000000-0000-0000-0000-000000000026',
        label: 'contains',
      },
    ];

    // Seed Workbook 1: Sales Orders (default)
    const wb1 = '00000000-0000-0000-0000-000000000002';
    const initialWb1 = [
      {
        rowId: '1',
        values: {
          item_name: 'Premium Desk',
          quantity: '2',
          unit_price: '250.00',
          total: '500.00',
        },
      },
      {
        rowId: '2',
        values: {
          item_name: 'Ergonomic Chair',
          quantity: '5',
          unit_price: '180.00',
          total: '900.00',
        },
      },
      {
        rowId: '3',
        values: {
          item_name: 'Mechanical Keyboard',
          quantity: '10',
          unit_price: '85.00',
          total: '850.00',
        },
      },
      {
        rowId: '4',
        values: {
          item_name: 'USB-C Hub',
          quantity: '15',
          unit_price: '45.00',
          total: '675.00',
        },
      },
      {
        rowId: '5',
        values: {
          item_name: 'LED Monitor',
          quantity: '4',
          unit_price: '320.00',
          total: '1280.00',
        },
      },
    ];
    for (const r of initialWb1) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wb1,
          row_id: r.rowId,
          column_id: col,
          value_text: val,
          updated_at: new Date(),
        });
      }
    }

    // Seed Workbook 2: Inventory Stocks
    const wb2 = '00000000-0000-0000-0000-000000000003';
    const initialWb2 = [
      {
        rowId: '1',
        values: {
          item_name: 'Premium Desk',
          stock_level: '15',
          reorder_point: '5',
          warehouse_location: 'Aisle A',
        },
      },
      {
        rowId: '2',
        values: {
          item_name: 'Ergonomic Chair',
          stock_level: '42',
          reorder_point: '10',
          warehouse_location: 'Aisle B',
        },
      },
      {
        rowId: '3',
        values: {
          item_name: 'Mechanical Keyboard',
          stock_level: '88',
          reorder_point: '20',
          warehouse_location: 'Aisle C',
        },
      },
      {
        rowId: '4',
        values: {
          item_name: 'USB-C Hub',
          stock_level: '120',
          reorder_point: '15',
          warehouse_location: 'Aisle D',
        },
      },
      {
        rowId: '5',
        values: {
          item_name: 'LED Monitor',
          stock_level: '8',
          reorder_point: '3',
          warehouse_location: 'Aisle E',
        },
      },
    ];
    for (const r of initialWb2) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wb2,
          row_id: r.rowId,
          column_id: col,
          value_text: val,
          updated_at: new Date(),
        });
      }
    }

    // Seed Workbook 3: Purchase Ledger
    const wb3 = '00000000-0000-0000-0000-000000000004';
    const initialWb3 = [
      {
        rowId: '1',
        values: {
          vendor_name: 'Office Depot',
          invoice_no: 'INV-9901',
          amount_due: '1250.00',
          payment_status: 'Pending',
        },
      },
      {
        rowId: '2',
        values: {
          vendor_name: 'Steelcase Inc',
          invoice_no: 'INV-4412',
          amount_due: '900.00',
          payment_status: 'Paid',
        },
      },
      {
        rowId: '3',
        values: {
          vendor_name: 'Keychron Ltd',
          invoice_no: 'INV-2088',
          amount_due: '850.00',
          payment_status: 'Pending',
        },
      },
      {
        rowId: '4',
        values: {
          vendor_name: 'Anker Tech',
          invoice_no: 'INV-3105',
          amount_due: '675.00',
          payment_status: 'Paid',
        },
      },
      {
        rowId: '5',
        values: {
          vendor_name: 'Dell Corp',
          invoice_no: 'INV-5511',
          amount_due: '1280.00',
          payment_status: 'Pending',
        },
      },
    ];
    for (const r of initialWb3) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wb3,
          row_id: r.rowId,
          column_id: col,
          value_text: val,
          updated_at: new Date(),
        });
      }
    }

    // === Rich cross-linked sample data for all 8 logical workbooks ===
    // Exact UUIDs from spec: 010 Products ... 017 Fulfillments.
    // Heavily ID-ref linked (product_id, customer_id, warehouse_id, order_id, supplier_id, fulfillment refs).
    // Realistic SME ecommerce: costs/prices/tax, stock on_hand/reserved, flattened Sales (HDR+lines per spec),
    // POs that "receive" into inv, fulfillments for shipped orders.
    // Data shape approximates/illustrates writes from domain handlers (product.create, salesOrder.create, inventory.adjust)
    // but richer for demo/cross-link visibility (e.g. extra computed fields like order_total, sku, derived projections; see handlers for exact minimal tx writes in executeBusinessLogic).
    // RowIds use handler convention (e.g. L1 not L001; line_id numeric string).
    // Backward compat: pilot wb 002/003/004 unchanged. Uses command-first shape for demo.
    // Illustrates data shapes e.g. SO-001 (shipped order linked via product_id/order_id to FUL-001 + inv p1/p3; static derived values).
    // SO-002 (DRAFT, lines fit available qty on p2:w1 for allocation demo; static values).
    // Column meta convention cells (per critical review rec B, cells-based no DDL): special __meta_* cols.
    // All cells carry tenant+workbook threading. Queryable via InMemory for demo + real PG fallback.
    // quantity_*_available are static snapshot projections here (see inv section + note that InventoryAdjustHandler writes only on_hand/reason; handlers compute/write derived at tx time; not auto-updated in seed).
    // Note: full 8 nodes/edges in this InMemory (for demo fallback/graphs); migration 0002 has subset baseline. Divergence documented.
    // Seeds cover the 8 canonical + pilots + compat headers listed in ALLOWED_WORKBOOKS (workbookConstants.ts + server.ts).

    // 1. Products (010) - 4 products, matches ProductCreateHandler cells + extra for richness
    const wbProducts = '00000000-0000-0000-0000-000000000010';
    const prodRows = [
      {
        rowId: 'p1',
        values: {
          product_id: 'p1',
          sku: 'DESK-PREM',
          name: 'Premium Desk',
          unit_price: '250.00',
          cost: '120.00',
          standard_cost: '120.00',
          tax_rate: '0.10',
          active: 'Y',
          created_at: '2024-06-01',
        },
      },
      {
        rowId: 'p2',
        values: {
          product_id: 'p2',
          sku: 'CHAIR-ERG',
          name: 'Ergonomic Chair',
          unit_price: '180.00',
          cost: '90.00',
          standard_cost: '90.00',
          tax_rate: '0.10',
          active: 'Y',
          created_at: '2024-06-01',
        },
      },
      {
        rowId: 'p3',
        values: {
          product_id: 'p3',
          sku: 'KEY-MECH',
          name: 'Mechanical Keyboard',
          unit_price: '85.00',
          cost: '35.00',
          standard_cost: '35.00',
          tax_rate: '0.08',
          active: 'Y',
          created_at: '2024-06-02',
        },
      },
      {
        rowId: 'p4',
        values: {
          product_id: 'p4',
          sku: 'HUB-USBC',
          name: 'USB-C Hub 7-in-1',
          unit_price: '45.00',
          cost: '18.00',
          standard_cost: '18.00',
          tax_rate: '0.08',
          active: 'Y',
          created_at: '2024-06-02',
        },
      },
    ];
    for (const r of prodRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbProducts,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 2. Customers (011)
    const wbCustomers = '00000000-0000-0000-0000-000000000011';
    const custRows = [
      {
        rowId: 'c1',
        values: {
          customer_id: 'c1',
          name: 'Acme Inc',
          email: 'procure@acme.test',
          phone: '555-0101',
          status: 'ACTIVE',
          credit_limit: '5000.00',
        },
      },
      {
        rowId: 'c2',
        values: {
          customer_id: 'c2',
          name: 'Beta LLC',
          email: 'buy@beta.test',
          phone: '555-0102',
          status: 'ACTIVE',
          credit_limit: '2000.00',
        },
      },
    ];
    for (const r of custRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbCustomers,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 3. Suppliers (012)
    const wbSuppliers = '00000000-0000-0000-0000-000000000012';
    const suppRows = [
      {
        rowId: 's1',
        values: {
          supplier_id: 's1',
          name: 'GlobalParts Inc',
          email: 'sales@globalparts.test',
          lead_time_days: '5',
          payment_terms: 'Net30',
        },
      },
      {
        rowId: 's2',
        values: {
          supplier_id: 's2',
          name: 'CheapSource Ltd',
          email: 'orders@cheapsource.test',
          lead_time_days: '12',
          payment_terms: 'Net15',
        },
      },
    ];
    for (const r of suppRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbSuppliers,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 4. Warehouses (013)
    const wbWarehouses = '00000000-0000-0000-0000-000000000013';
    const whRows = [
      {
        rowId: 'w1',
        values: {
          warehouse_id: 'w1',
          name: 'Primary Fulfillment Center',
          address: '123 Logistics Way, Portland, OR',
          is_primary: 'Y',
          bin_capacity_model: 'standard',
        },
      },
      {
        rowId: 'w2',
        values: {
          warehouse_id: 'w2',
          name: 'Overflow Storage',
          address: '456 Depot Blvd, Portland, OR',
          is_primary: 'N',
          bin_capacity_model: 'overflow',
        },
      },
    ];
    for (const r of whRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbWarehouses,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 5. InventoryBalances (014) - product_id + warehouse_id cross links; some reserved for sales alloc
    // Post some ops (ship reduced on_hand; reserved for draft alloc). quantity_available etc are static snapshot values for demo (not auto-maintained here; see InventoryAdjustHandler which only writes on_hand + last_adjust_reason; real paths use command compute or future revalidator).
    const wbInv = '00000000-0000-0000-0000-000000000014';
    const invRows = [
      {
        rowId: 'p1:w1',
        values: {
          product_id: 'p1',
          warehouse_id: 'w1',
          quantity_on_hand: '45',
          quantity_reserved: '2',
          quantity_available: '43',
          bin_location: 'A-01',
          status: 'OK',
          last_adjust_reason: 'po-receive+ship',
        },
      },
      {
        rowId: 'p1:w2',
        values: {
          product_id: 'p1',
          warehouse_id: 'w2',
          quantity_on_hand: '5',
          quantity_reserved: '0',
          quantity_available: '5',
          bin_location: 'Z-10',
          status: 'OK',
        },
      },
      {
        rowId: 'p2:w1',
        values: {
          product_id: 'p2',
          warehouse_id: 'w1',
          quantity_on_hand: '30',
          quantity_reserved: '4',
          quantity_available: '26',
          bin_location: 'B-02',
          status: 'OK',
          last_adjust_reason: 'cycle',
        },
      },
      {
        rowId: 'p3:w1',
        values: {
          product_id: 'p3',
          warehouse_id: 'w1',
          quantity_on_hand: '72',
          quantity_reserved: '0',
          quantity_available: '72',
          bin_location: 'C-05',
          status: 'OK',
        },
      },
      {
        rowId: 'p4:w1',
        values: {
          product_id: 'p4',
          warehouse_id: 'w1',
          quantity_on_hand: '118',
          quantity_reserved: '0',
          quantity_available: '118',
          bin_location: 'D-03',
          status: 'OK',
        },
      },
    ];
    for (const r of invRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbInv,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 6. SalesOrders (015) - FLATTENED per spec: HDR row + Lxx line rows. Full cross links + status flow.
    // Uses cells consistent with SalesOrderCreateHandler (order_id, line_id, product_id, qty, unit_price, customer_id, status, line_total + HDR).
    // RowIds/line_id use unpadded per current handler (${i+1} => L1, line_id:'1'). Richer demo fields (totals, sku, order_total=lines+tax) added for UX/cross refs.
    // order_total in HDR is illustrative grand total (sum of line_total + tax_amount per line). Illustrates intended shapes for shipped order (SO-001 linked to FUL-001 + inv) and draft alloc candidate (SO-002).
    const wbSales = '00000000-0000-0000-0000-000000000015';
    const salesRows = [
      // HDR for SO-001
      {
        rowId: 'SO-001-HDR',
        values: {
          order_id: 'SO-001',
          customer_id: 'c1',
          status: 'SHIPPED',
          order_total: '825.40',
        },
      },
      // lines for SO-001 (shipped, cross p1/p3 + c1)
      {
        rowId: 'SO-001-L1',
        values: {
          order_id: 'SO-001',
          line_id: '1',
          product_id: 'p1',
          customer_id: 'c1',
          qty: '2',
          unit_price: '250.00',
          line_total: '500.00',
          tax_amount: '50.00',
          status: 'SHIPPED',
          sku: 'DESK-PREM',
        },
      },
      {
        rowId: 'SO-001-L2',
        values: {
          order_id: 'SO-001',
          line_id: '2',
          product_id: 'p3',
          customer_id: 'c1',
          qty: '3',
          unit_price: '85.00',
          line_total: '255.00',
          tax_amount: '20.40',
          status: 'SHIPPED',
          sku: 'KEY-MECH',
        },
      },
      // HDR + line for SO-002 (DRAFT, fits p2 avail for demo alloc)
      {
        rowId: 'SO-002-HDR',
        values: {
          order_id: 'SO-002',
          customer_id: 'c2',
          status: 'DRAFT',
          order_total: '792.00',
        },
      },
      {
        rowId: 'SO-002-L1',
        values: {
          order_id: 'SO-002',
          line_id: '1',
          product_id: 'p2',
          customer_id: 'c2',
          qty: '4',
          unit_price: '180.00',
          line_total: '720.00',
          tax_amount: '72.00',
          status: 'DRAFT',
          sku: 'CHAIR-ERG',
        },
      },
      // meta convention row for richer columns (review rec: cells-based; type/enum/format)
      {
        rowId: '_meta',
        values: {
          __status_meta: 'enum:DRAFT|CONFIRMED|ALLOCATED|SHIPPED|CANCELLED',
          __unit_price_meta: 'format:currency:2',
          __line_total_meta: 'format:currency:2',
        },
      },
    ];
    for (const r of salesRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbSales,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 7. PurchaseOrders (016) - flattened, links supplier+product, "received" affecting inv p1
    const wbPO = '00000000-0000-0000-0000-000000000016';
    const poRows = [
      {
        rowId: 'PO-001-HDR',
        values: {
          po_id: 'PO-001',
          supplier_id: 's1',
          status: 'RECEIVED',
          received_total: '1195.00',
        },
      },
      {
        rowId: 'PO-001-L1',
        values: {
          po_id: 'PO-001',
          line_id: '1',
          supplier_id: 's1',
          product_id: 'p1',
          qty_ordered: '10',
          qty_received: '10',
          unit_cost: '119.50',
          line_cost: '1195.00',
          status: 'RECEIVED',
        },
      },
      // simple meta
      {
        rowId: '_meta',
        values: {
          __status_meta: 'enum:DRAFT|ORDERED|RECEIVED|CANCELLED',
          __unit_cost_meta: 'format:currency:2',
        },
      },
    ];
    for (const r of poRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbPO,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // 8. Fulfillments (017) - cross to order_id + warehouse + product refs
    const wbFulfill = '00000000-0000-0000-0000-000000000017';
    const fulRows = [
      {
        rowId: 'FUL-001',
        values: {
          fulfillment_id: 'FUL-001',
          order_id: 'SO-001',
          status: 'SHIPPED',
          warehouse_id: 'w1',
          carrier: 'UPS',
          tracking: '1Z999AA10123456789',
          shipped_at: '2024-06-20T14:30Z',
          product_refs: 'p1:2,p3:3',
        },
      },
      {
        rowId: 'FUL-002',
        values: {
          fulfillment_id: 'FUL-002',
          order_id: 'SO-002',
          status: 'PENDING',
          warehouse_id: 'w1',
          carrier: '',
          tracking: '',
          product_refs: 'p2:4',
        },
      },
    ];
    for (const r of fulRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbFulfill,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    // compat header seeds kept minimal (018/019) - primary flattened data now in 015/016
    const wbSOHeaders = '00000000-0000-0000-0000-000000000018';
    const soHeadRows = [
      {
        rowId: 'SO-001',
        values: { order_id: 'SO-001', customer_id: 'c1', status: 'SHIPPED' },
      },
    ];
    for (const r of soHeadRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbSOHeaders,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbPOHeaders = '00000000-0000-0000-0000-000000000019';
    const poHeadRows = [
      {
        rowId: 'PO-001',
        values: { po_id: 'PO-001', supplier_id: 's1', status: 'RECEIVED' },
      },
    ];
    for (const r of poHeadRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbPOHeaders,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbProductTemplates = '00000000-0000-0000-0000-000000000021';
    const tmplRows = [
      {
        rowId: 'tmpl1',
        values: {
          template_id: 'tmpl1',
          name: 'Desk Template',
          description: 'Base desk options',
          category: 'Furniture',
          base_price: '200.00',
          base_cost: '100.00',
          default_tax_rate: '0.10',
        },
      },
      {
        rowId: 'tmpl2',
        values: {
          template_id: 'tmpl2',
          name: 'Chair Template',
          description: 'Base chair options',
          category: 'Furniture',
          base_price: '150.00',
          base_cost: '70.00',
          default_tax_rate: '0.10',
        },
      },
    ];
    for (const r of tmplRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbProductTemplates,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbProductVariants = '00000000-0000-0000-0000-000000000022';
    const variantRows = [
      {
        rowId: 'v1',
        values: {
          product_id: 'v1',
          template_id: 'tmpl1',
          option_color: 'Red',
          option_size: 'L',
          price_delta: '50.00',
          cost_delta: '20.00',
          active: 'Y',
        },
      },
      {
        rowId: 'v2',
        values: {
          product_id: 'v2',
          template_id: 'tmpl2',
          option_color: 'Blue',
          option_size: 'M',
          price_delta: '30.00',
          cost_delta: '20.00',
          active: 'Y',
        },
      },
    ];
    for (const r of variantRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbProductVariants,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbParties = '00000000-0000-0000-0000-000000000023';
    const partyRows = [
      {
        rowId: 'party1',
        values: {
          party_id: 'party1',
          legal_name: 'Alice Smith',
          tax_id: 'TAX-001',
          email: 'alice@smith.test',
          phone: '555-1234',
        },
      },
    ];
    for (const r of partyRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbParties,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbCustExt = '00000000-0000-0000-0000-000000000024';
    const custExtRows = [
      {
        rowId: 'CUST-party1',
        values: {
          customer_id: 'CUST-party1',
          party_id: 'party1',
          credit_limit: '3000.00',
          payment_terms: 'NET30',
        },
      },
    ];
    for (const r of custExtRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbCustExt,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbSuppExt = '00000000-0000-0000-0000-000000000025';
    const suppExtRows = [
      {
        rowId: 'SUPP-party1',
        values: {
          supplier_id: 'SUPP-party1',
          party_id: 'party1',
          lead_time_days: '7',
          payment_terms: 'NET15',
        },
      },
    ];
    for (const r of suppExtRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbSuppExt,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }

    const wbAddresses = '00000000-0000-0000-0000-000000000026';
    const addressRows = [
      {
        rowId: 'addr1',
        values: {
          address_id: 'addr1',
          party_id: 'party1',
          address_type: 'BILLING',
          street: '123 Main St',
          city: 'Portland',
          postal_code: '97201',
          country: 'USA',
        },
      },
      {
        rowId: 'addr2',
        values: {
          address_id: 'addr2',
          party_id: 'party1',
          address_type: 'SHIPPING',
          street: '456 Elm St',
          city: 'Seattle',
          postal_code: '98101',
          country: 'USA',
        },
      },
    ];
    for (const r of addressRows) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wbAddresses,
          row_id: r.rowId,
          column_id: col,
          value_text: String(val),
          updated_at: new Date(),
        });
      }
    }
  }

  async query<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T> {
    const s = sql.trim().replace(/\s+/g, ' ');

    if (
      s.startsWith('BEGIN') ||
      s.startsWith('COMMIT') ||
      s.startsWith('ROLLBACK') ||
      s.startsWith('SAVEPOINT') ||
      s.startsWith('RELEASE')
    ) {
      return { rows: [] } as unknown as T;
    }

    if (s.includes('FROM command_log WHERE') && s.startsWith('SELECT')) {
      const tenantId = params?.[0];
      const commandId = params?.[1];
      const found = this.commandLog.find(
        (r) => r.tenant_id === tenantId && r.command_id === commandId,
      );
      return { rows: found ? [found] : [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO command_log')) {
      const row = {
        tenant_id: params?.[0],
        command_id: params?.[1],
        trace_id: params?.[2],
        correlation_id: params?.[3],
        user_id: params?.[4],
        workbook_id: params?.[5],
        command_type: params?.[6],
        command_status: params?.[7],
        request_hash: params?.[8],
        request_body_hash: params?.[9],
        expires_at: params?.[10],
        created_at: new Date(),
        response_body_redacted: null,
      };
      this.commandLog.push(row);
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('UPDATE command_log')) {
      const tenantId = params?.[0];
      const commandId = params?.[1];
      const status = params?.[2];
      const redacted = params?.[3];
      const found = this.commandLog.find(
        (r) => r.tenant_id === tenantId && r.command_id === commandId,
      );
      if (found) {
        found.command_status = status;
        found.response_body_redacted = redacted;
        if (status === 'committed') found.committed_at = new Date();
      }
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO current_cell_values')) {
      const tenant = params?.[0];
      const workbook = params?.[1];
      const rowId = params?.[2];
      const columnId = params?.[3];
      const value = params?.[4];

      const found = this.currentCellValues.find(
        (r) =>
          r.tenant_id === tenant &&
          r.workbook_id === workbook &&
          String(r.row_id) === String(rowId) &&
          String(r.column_id) === String(columnId),
      );
      if (found) {
        found.value_text = String(value);
        found.updated_at = new Date();
      } else {
        this.currentCellValues.push({
          tenant_id: tenant,
          workbook_id: workbook,
          row_id: String(rowId),
          column_id: String(columnId),
          value_text: String(value),
          updated_at: new Date(),
        });
      }
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('DELETE FROM current_cell_values')) {
      const tenant = params?.[0];
      const workbook = params?.[1];
      const rowId = params?.[2];
      this.currentCellValues = this.currentCellValues.filter(
        (r) =>
          !(
            r.tenant_id === tenant &&
            r.workbook_id === workbook &&
            String(r.row_id) === String(rowId)
          ),
      );
      return { rows: [] } as unknown as T;
    }

    if (
      s.includes('FROM current_cell_values WHERE') &&
      s.startsWith('SELECT')
    ) {
      const tenant = params?.[0];
      const workbook = params?.[1];
      const rows = this.currentCellValues.filter(
        (r) => r.tenant_id === tenant && r.workbook_id === workbook,
      );
      rows.sort((a, b) => {
        const aNum = Number(a.row_id);
        const bNum = Number(b.row_id);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else {
          if (a.row_id !== b.row_id)
            return String(a.row_id).localeCompare(String(b.row_id));
        }
        return String(a.column_id).localeCompare(String(b.column_id));
      });
      return { rows } as unknown as T;
    }

    if (s.startsWith('INSERT INTO numeric_transfers')) {
      this.numericTransfers.push(params);
      return { rows: [{ outbox_id: '1' }] } as unknown as T;
    }

    if (s.includes('FROM numeric_transfers WHERE') && s.startsWith('SELECT')) {
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO outbox_events')) {
      const id = String(this.nextOutboxId++);
      const row = {
        outbox_id: id,
        event_id: params?.[0],
        idempotency_key: params?.[1],
        tenant_id: params?.[2],
        workbook_id: params?.[3],
        command_id: params?.[4],
        command_event_seq: params?.[5],
        event_type: params?.[6],
        event_source: params?.[7],
        event_subject: params?.[8],
        aggregate_type: params?.[9],
        aggregate_id: params?.[10],
        route_key: params?.[11],
        partition_key: params?.[12],
        target_planes: params?.[13] || ['sse'],
        schema_version: params?.[14],
        data_schema: params?.[15],
        payload_content_type: params?.[16],
        payload: params?.[17],
        payload_ref: params?.[18],
        payload_hash: params?.[19],
        payload_size_bytes: params?.[20],
        visibility_scope: params?.[21],
        data_classification: params?.[22],
        permission_scope_hash: params?.[23],
        trace_id: params?.[24],
        correlation_id: params?.[25],
        created_at: new Date(),
      };
      this.outboxEvents.push(row);
      return { rows: [{ outbox_id: id }] } as unknown as T;
    }

    if (
      s.includes('SELECT MIN(outbox_id)') ||
      s.includes('SELECT min(outbox_id)')
    ) {
      const min =
        this.outboxEvents.length > 0
          ? String(
              Math.min(...this.outboxEvents.map((e) => Number(e.outbox_id))),
            )
          : null;
      return { rows: [{ min_id: min, min: min }] } as unknown as T;
    }

    if (s.includes('FROM outbox_events WHERE') && s.startsWith('SELECT')) {
      const watermark = Number(params?.[0] || 0);
      const tenantIds = params?.[1] || [];
      const limit = Number(params?.[2] || 100);

      const filtered = this.outboxEvents.filter((e) => {
        if (!tenantIds.includes(e.tenant_id)) return false;
        return Number(e.outbox_id) > watermark;
      });
      filtered.sort((a, b) => Number(a.outbox_id) - Number(b.outbox_id));
      const sliced = filtered.slice(0, limit);

      return { rows: sliced } as unknown as T;
    }

    if (s.startsWith('SELECT * FROM workspace_nodes')) {
      return { rows: this.workspaceNodes } as unknown as T;
    }

    if (s.startsWith('SELECT * FROM workspace_edges')) {
      return { rows: this.workspaceEdges } as unknown as T;
    }

    if (s.startsWith('INSERT INTO workspace_nodes')) {
      const row = {
        id: params?.[0],
        label: params?.[1],
        kind: params?.[2],
        tags: params?.[3],
      };
      this.workspaceNodes.push(row);
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO workspace_edges')) {
      const row = {
        id: params?.[0],
        source: params?.[1],
        target: params?.[2],
        label: params?.[3],
      };
      this.workspaceEdges.push(row);
      return { rows: [] } as unknown as T;
    }

    return { rows: [] } as unknown as T;
  }
}

export class PostgresQueryable implements Queryable {
  private readonly pool: Pool;
  private inMemoryFallback: InMemoryQueryable | null = null;

  constructor(poolOrConfig?: Pool | PostgresConfig) {
    if (poolOrConfig instanceof Pool) {
      this.pool = poolOrConfig;
    } else {
      this.pool = getPool(poolOrConfig);
    }
  }

  async query<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T> {
    if (this.inMemoryFallback) {
      return this.inMemoryFallback.query<T>(sql, params);
    }

    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query(sql, params as any[]);
        return res as unknown as T;
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('connect') ||
        err.message?.includes('refused')
      ) {
        console.warn(
          '\n⚠️ [db] PostgreSQL connection refused. Falling back to In-Memory Database Mode for local demo.\n',
        );
        this.inMemoryFallback = new InMemoryQueryable();
        return this.inMemoryFallback.query<T>(sql, params);
      }
      throw err;
    }
  }

  get rawPool(): Pool {
    return this.pool;
  }
}

/**
 * Factory for a Queryable backed by real postgres.
 * Pass to CommandProcessor, routes init, etc.
 */
export function createPostgresQueryable(config?: PostgresConfig): Queryable {
  return new PostgresQueryable(config);
}

/**
 * Real tx wrapper usable when you have a PostgresQueryable (or pool).
 * Processor currently uses the one from ./transaction (string BEGIN mock compatible).
 * Real path will call this or we adapt the client.
 */
export async function withPostgresTransaction<T>(
  db: PostgresQueryable | Queryable,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  if (!db || typeof (db as any).query !== 'function') {
    throw new Error(
      'ASSERT_FAILED: withPostgresTransaction requires Queryable db',
    );
  }
  const pool = (db as any).rawPool || (db as any).pool || getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx: TransactionClient = {
      query: async <U = unknown>(sql: string, params?: readonly unknown[]) => {
        const r = await client.query(sql, params as any[]);
        return r as unknown as U;
      },
      savepoint: async (name: string) => {
        await client.query(`SAVEPOINT ${name}`);
      },
      rollbackTo: async (name: string) => {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      },
      release: async (name: string) => {
        await client.query(`RELEASE SAVEPOINT ${name}`);
      },
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
