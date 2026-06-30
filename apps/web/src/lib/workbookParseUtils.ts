import type { GridColumn, GridRow } from "../components/SpreadsheetGrid";

export const DEFAULT_COLUMNS: GridColumn[] = [
  { columnId: "item_name", label: "Item Name" },
  { columnId: "quantity", label: "Quantity" },
  { columnId: "unit_price", label: "Unit Price" },
  { columnId: "total", label: "Total" },
];

function parseGridColumn(raw: Record<string, unknown>): GridColumn | null {
  if (typeof raw.columnId !== "string" || typeof raw.label !== "string") return null;
  const col: GridColumn = { columnId: raw.columnId, label: raw.label };
  if (raw.type === "enum" || raw.type === "number" || raw.type === "text") {
    col.type = raw.type;
  }
  if (raw.format === "currency" || raw.format === "plain") {
    col.format = raw.format;
  }
  if (Array.isArray(raw.enumOptions)) {
    col.enumOptions = raw.enumOptions.filter((opt): opt is string => typeof opt === "string");
  }
  if (raw.readOnly === true) col.readOnly = true;
  if (raw.protected === true) col.protected = true;
  return col;
}

export function normalizeGridValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null) return "";
  return null;
}

interface WorkbookResponse {
  rows: Array<{ rowId: unknown; values: unknown }>;
  columns?: Array<Record<string, unknown>>;
}

export function parseWorkbookResponse(
  payload: unknown
): { rows: GridRow[]; columns: GridColumn[] } | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as WorkbookResponse;

  if (!Array.isArray(data.rows)) return null;
  const normalizedRows: GridRow[] = [];
  for (const row of data.rows) {
    if (!row || typeof row !== "object") return null;
    const rowId = typeof row.rowId === "string" ? row.rowId.trim() : "";
    if (!rowId || !row.values || typeof row.values !== "object" || Array.isArray(row.values)) return null;
    const values: Record<string, string> = {};
    for (const [columnId, value] of Object.entries(row.values as Record<string, unknown>)) {
      const nv = normalizeGridValue(value);
      if (nv !== null) values[columnId] = nv;
    }
    normalizedRows.push({ rowId, values });
  }

  let parsedColumns: GridColumn[] | null = null;
  if (Array.isArray(data.columns)) {
    parsedColumns = [];
    for (const col of data.columns) {
      if (col && typeof col === "object") {
        const parsed = parseGridColumn(col);
        if (parsed) parsedColumns.push(parsed);
      }
    }
  }

  return { rows: normalizedRows, columns: parsedColumns || DEFAULT_COLUMNS };
}