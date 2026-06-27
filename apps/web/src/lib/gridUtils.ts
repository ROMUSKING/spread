import { COLUMN_WIDTH_DEFAULT } from "./uiConstants.ts";
import { clampColumnWidth } from "./preferencesUtils.ts";

export type CommandVisualState =
  | "pending"
  | "committed"
  | "rejected"
  | "ambiguous_requires_refresh";

export function cellStatusClass(state?: CommandVisualState): string {
  if (!state) return "";
  if (state === "pending") return "spreadsheet-cell--pending";
  if (state === "committed") return "spreadsheet-cell--committed";
  if (state === "rejected") return "spreadsheet-cell--rejected";
  if (state === "ambiguous_requires_refresh") return "spreadsheet-cell--ambiguous";
  return "";
}

export function resolveColumnWidth(
  columnId: string,
  workbookId: string | undefined,
  getColumnWidth: ((workbookId: string, columnId: string) => number | undefined) | undefined,
  draftWidths: Record<string, number>
): number {
  if (draftWidths[columnId] !== undefined) {
    return clampColumnWidth(draftWidths[columnId]);
  }
  if (workbookId && getColumnWidth) {
    const stored = getColumnWidth(workbookId, columnId);
    if (stored !== undefined) {
      return clampColumnWidth(stored);
    }
  }
  return COLUMN_WIDTH_DEFAULT;
}