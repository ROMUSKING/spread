-- Migration 0002: Workspace Metadata and Document Header Tables
-- Defined for version 0.17.0 baseline

-- 1. Workspace Nodes (Categories & Workbooks)
CREATE TABLE workspace_nodes (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('category', 'workbook')),
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
);

-- 2. Workspace Edges (Links / Relationships)
CREATE TABLE workspace_edges (
  id UUID PRIMARY KEY,
  source UUID NOT NULL REFERENCES workspace_nodes(id) ON DELETE CASCADE,
  target UUID NOT NULL REFERENCES workspace_nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL
);

-- 3. Document Headers (Relational Metadata)
CREATE TABLE sales_order_headers (
  tenant_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, order_id)
);

CREATE TABLE purchase_order_headers (
  tenant_id UUID NOT NULL,
  po_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, po_id)
);

-- Seed initial nodes
INSERT INTO workspace_nodes (id, label, kind, tags) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Sales Operations', 'category', '{}'::TEXT[]),
  ('00000000-0000-0000-0000-000000000102', 'Warehouse & Inventory', 'category', '{}'::TEXT[]),
  ('00000000-0000-0000-0000-000000000103', 'Accounting & Finance', 'category', '{}'::TEXT[]),
  ('00000000-0000-0000-0000-000000000002', 'Sales Orders', 'workbook', ARRAY['sales', 'orders']),
  ('00000000-0000-0000-0000-000000000003', 'Inventory Stock', 'workbook', ARRAY['warehouse', 'stock']),
  ('00000000-0000-0000-0000-000000000004', 'Purchase Ledger', 'workbook', ARRAY['finance', 'ledger']),
  ('00000000-0000-0000-0000-000000000010', 'Products', 'workbook', ARRAY['catalog']),
  ('00000000-0000-0000-0000-000000000014', 'Inventory Balances', 'workbook', ARRAY['warehouse', 'stock']),
  ('00000000-0000-0000-0000-000000000015', 'Sales Orders (domain)', 'workbook', ARRAY['sales', 'orders']),
  ('00000000-0000-0000-0000-000000000018', 'Sales Order Headers', 'workbook', ARRAY['sales', 'orders', 'headers']),
  ('00000000-0000-0000-0000-000000000019', 'Purchase Order Headers', 'workbook', ARRAY['finance', 'ledger', 'headers'])
ON CONFLICT (id) DO NOTHING;

-- Seed initial edges
INSERT INTO workspace_edges (id, source, target, label) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'contains'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000003', 'contains'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000004', 'contains'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000002', 'contains'),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'deducts stock via item_name (legacy; migrate to id)'),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'funds order fulfillment'),
  ('00000000-0000-0000-0000-000000000207', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'triggers reorder purchases'),
  ('00000000-0000-0000-0000-000000000208', '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000014', 'allocates from InventoryBalances via product_id'),
  ('00000000-0000-0000-0000-000000000209', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000014', 'defines stock for product'),
  ('00000000-0000-0000-0000-000000000210', '00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000015', 'headers link to lines'),
  ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000016', 'purchase headers link to lines')
ON CONFLICT (id) DO NOTHING;
