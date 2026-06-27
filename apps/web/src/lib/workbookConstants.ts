export const ALLOWED_WORKBOOKS = [
  "00000000-0000-0000-0000-000000000002", // Sales Orders (pilot, evolves toward 015)
  "00000000-0000-0000-0000-000000000003", // Inventory Stock (pilot, evolves toward 014)
  "00000000-0000-0000-0000-000000000004", // Purchase Ledger (pilot)
  // New ecommerce + warehouse logical workbooks (from sme-ecommerce-domain-model-and-business-logic-spec.md PR2)
  // KEEP IN SYNC: also update workbookUtils.ts, app/page.tsx, apps/api/src/server.ts ALLOWED + all .includes guards (see design Issue 2)
  "00000000-0000-0000-0000-000000000010", // Products
  "00000000-0000-0000-0000-000000000011", // Customers
  "00000000-0000-0000-0000-000000000012", // Suppliers
  "00000000-0000-0000-0000-000000000013", // Warehouses
  "00000000-0000-0000-0000-000000000014", // InventoryBalances
  "00000000-0000-0000-0000-000000000015", // SalesOrders
  "00000000-0000-0000-0000-000000000016", // PurchaseOrders
  "00000000-0000-0000-0000-000000000017", // Fulfillments
  "00000000-0000-0000-0000-000000000018", // SalesOrderHeaders
  "00000000-0000-0000-0000-000000000019", // PurchaseOrderHeaders
  // Extended master data workbooks (from sme-extended-variants-and-entities-spec.md)
  "00000000-0000-0000-0000-000000000021", // ProductTemplates
  "00000000-0000-0000-0000-000000000022", // ProductVariants
  "00000000-0000-0000-0000-000000000023", // Parties
  "00000000-0000-0000-0000-000000000024", // Customers (extended)
  "00000000-0000-0000-0000-000000000025", // Suppliers (extended)
  "00000000-0000-0000-0000-000000000026", // Addresses
] as const;

export type AllowedWorkbookId = (typeof ALLOWED_WORKBOOKS)[number];

export function isAllowedWorkbook(workbookId: string): workbookId is AllowedWorkbookId {
  return (ALLOWED_WORKBOOKS as readonly string[]).includes(workbookId);
}