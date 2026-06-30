import type { GridRow } from "../components/SpreadsheetGrid";

export const SALES_ORDERS_WORKBOOK_ID = "00000000-0000-0000-0000-000000000015";

const HDR_SUFFIX = "-HDR";
const LINE_ROW_PATTERN = /^(.+)-L\d+$/;

export type SalesOrderGroup = {
  groupKey: string;
  header: GridRow;
  lines: GridRow[];
};

export function isSalesOrderHeaderRow(rowId: string): boolean {
  return rowId.endsWith(HDR_SUFFIX);
}

export function isSalesOrderLineRow(rowId: string): boolean {
  return LINE_ROW_PATTERN.test(rowId);
}

export function salesOrderGroupKey(rowId: string): string | null {
  if (isSalesOrderHeaderRow(rowId)) {
    return rowId.slice(0, -HDR_SUFFIX.length);
  }
  const match = rowId.match(LINE_ROW_PATTERN);
  return match?.[1] ?? null;
}

export function shouldGroupSalesOrders(workbookId: string | undefined, rows: GridRow[]): boolean {
  if (workbookId !== SALES_ORDERS_WORKBOOK_ID) return false;
  return rows.some((r) => isSalesOrderHeaderRow(r.rowId)) && rows.some((r) => isSalesOrderLineRow(r.rowId));
}

export function buildSalesOrderGroups(rows: GridRow[]): SalesOrderGroup[] {
  const groups = new Map<string, SalesOrderGroup>();

  for (const row of rows) {
    const groupKey = salesOrderGroupKey(row.rowId);
    if (!groupKey) continue;

    let group = groups.get(groupKey);
    if (!group) {
      group = { groupKey, header: row, lines: [] };
      groups.set(groupKey, group);
    }

    if (isSalesOrderHeaderRow(row.rowId)) {
      group.header = row;
    } else if (isSalesOrderLineRow(row.rowId)) {
      group.lines.push(row);
    }
  }

  return Array.from(groups.values()).filter((g) => isSalesOrderHeaderRow(g.header.rowId));
}

export function applySalesOrderCollapse(
  rows: GridRow[],
  collapsedGroups: ReadonlySet<string>
): GridRow[] {
  return rows.filter((row) => {
    const groupKey = salesOrderGroupKey(row.rowId);
    if (!groupKey) return true;
    if (isSalesOrderHeaderRow(row.rowId)) return true;
    if (isSalesOrderLineRow(row.rowId)) return !collapsedGroups.has(groupKey);
    return true;
  });
}

export function summarizeSalesOrderHeader(row: GridRow): string {
  const parts: string[] = [];
  if (row.values.order_id) parts.push(row.values.order_id);
  if (row.values.customer_id) parts.push(`Customer ${row.values.customer_id}`);
  if (row.values.status) parts.push(row.values.status);
  if (row.values.order_total) parts.push(`Total ${row.values.order_total}`);
  return parts.join(" · ");
}

export function lineCountForGroup(rows: GridRow[], groupKey: string): number {
  return rows.filter(
    (r) => isSalesOrderLineRow(r.rowId) && salesOrderGroupKey(r.rowId) === groupKey
  ).length;
}

export function toggleCollapsedGroup(
  collapsed: Set<string>,
  groupKey: string
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(groupKey)) {
    next.delete(groupKey);
  } else {
    next.add(groupKey);
  }
  return next;
}