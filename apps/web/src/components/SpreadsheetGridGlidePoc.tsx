"use client";

/**
 * ADR-0028 Glide Data Grid POC — command wiring spike (not mounted in production shell).
 * Demonstrates onCellEdited → cell.update envelope parity with SpreadsheetGrid.
 */
import { useCallback } from "react";
import type { GridColumn } from "@erp/contracts/grid-column";
import { cellStatusClass } from "../lib/gridUtils";
import { formatDisplayValue, isColumnEditable } from "../lib/columnMetaUtils";
import type { CommandState, GridRow } from "./SpreadsheetGrid";

export type SpreadsheetGridGlidePocProps = {
  rows: GridRow[];
  columns: GridColumn[];
  workbookId: string;
  onCellEdit: (rowId: string, columnId: string, value: string) => void;
  commandStates: Map<string, CommandState>;
};

/**
 * Glide adapter: maps canvas grid edit events to command_api cell.update shape.
 * Production Glide mount replaces this stub table when POC acceptance criteria pass.
 */
export function SpreadsheetGridGlidePoc({
  rows,
  columns,
  workbookId,
  onCellEdit,
  commandStates,
}: SpreadsheetGridGlidePocProps) {
  const onCellEdited = useCallback(
    (rowId: string, columnId: string, value: string) => {
      onCellEdit(rowId, columnId, value);
    },
    [onCellEdit]
  );

  return (
    <div className="spreadsheet spreadsheet--glide-poc" data-testid="glide-poc-grid">
      <p className="spreadsheet-glide-poc__banner">
        Glide POC — edits route through onCellEdited → cell.update
      </p>
      <table className="spreadsheet-table" role="grid" aria-label="Glide POC grid">
        <thead className="spreadsheet-header">
          <tr>
            {columns.map((col) => (
              <th key={col.columnId} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.rowId} role="row">
              {columns.map((col) => {
                const cellId = `${workbookId}:${row.rowId}:${col.columnId}`;
                const cmdState = commandStates.get(cellId);
                const rawVal = row.values[col.columnId] || "";
                const displayVal =
                  cmdState && cmdState.state !== "rejected" ? cmdState.value : rawVal;
                const editable = isColumnEditable(col);

                return (
                  <td
                    key={col.columnId}
                    role="gridcell"
                    className={`spreadsheet-cell ${cellStatusClass(cmdState?.state)}`}
                    contentEditable={editable}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      if (!editable) return;
                      const next = e.currentTarget.textContent || "";
                      if (next !== rawVal) {
                        onCellEdited(row.rowId, col.columnId, next);
                      }
                    }}
                  >
                    {formatDisplayValue(displayVal, col)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}