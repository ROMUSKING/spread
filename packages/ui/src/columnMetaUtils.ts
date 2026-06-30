import type { GridColumn } from "@erp/contracts/grid-column";

export function isColumnEditable(column: GridColumn): boolean {
  return !column.readOnly && !column.protected;
}

export function columnUsesEnumSelect(column: GridColumn): boolean {
  return column.type === "enum" && (column.enumOptions?.length ?? 0) > 0;
}

export function formatDisplayValue(value: string, column: GridColumn): string {
  if (!value) return "";
  if (column.format === "currency") {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    }
  }
  return value;
}

export function columnEditorInputType(column: GridColumn): "text" | "number" {
  return column.type === "number" ? "number" : "text";
}

export function protectedCellTitle(column: GridColumn): string {
  if (column.protected) {
    return "Protected field — use business actions to change this value";
  }
  if (column.readOnly) {
    return "Read-only field";
  }
  return "";
}