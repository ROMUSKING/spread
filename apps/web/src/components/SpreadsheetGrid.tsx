/**
 * SpreadsheetGrid — AGENT-060
 *
 * A minimal editable grid component that renders spreadsheet data in a table structure.
 * Supports inline editing, keyboard navigation, visual command status overlays,
 * and ARIA labels for accessibility.
 *
 * @see docs/plan/vertical-slice-acceptance-checklist.md
 */
import { useState, useRef, useEffect } from "react";

export type CommandState = {
  state: "pending" | "committed" | "rejected" | "ambiguous_requires_refresh";
  value: string;
  error?: string | undefined;
};

export type GridRow = {
  rowId: string;
  values: Record<string, string>;
};

export type GridColumn = {
  columnId: string;
  label: string;
};

export type SpreadsheetGridProps = {
  rows: GridRow[];
  columns: GridColumn[];
  onCellEdit: (rowId: string, columnId: string, value: string) => void;
  commandStates: Map<string, CommandState>; // key is "rowId:columnId"
};

export function SpreadsheetGrid({
  rows,
  columns,
  onCellEdit,
  commandStates,
}: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    value: string;
  } | null>(null);

  const [activeCell, setActiveCell] = useState<{
    rowIndex: number;
    colIndex: number;
  }>({ rowIndex: 0, colIndex: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const editHandledRef = useRef(false);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      editHandledRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const finishEditing = (mode: "commit" | "cancel"): void => {
    if (!editingCell) {
      return;
    }

    editHandledRef.current = true;

    if (mode === "commit") {
      onCellEdit(editingCell.rowId, editingCell.columnId, editingCell.value);
    }

    setEditingCell(null);
    tableRef.current?.focus();
  };

  const handleCellClick = (rowId: string, columnId: string, value: string, rowIndex: number, colIndex: number) => {
    setActiveCell({ rowIndex, colIndex });
    setEditingCell({ rowId, columnId, value });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        finishEditing("commit");
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishEditing("cancel");
      }
      return;
    }

    // Grid Navigation Mode
    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (rowIndex > 0) nextRow--;
        break;
      case "ArrowDown":
        e.preventDefault();
        if (rowIndex < rows.length - 1) nextRow++;
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (colIndex > 0) nextCol--;
        break;
      case "ArrowRight":
        e.preventDefault();
        if (colIndex < columns.length - 1) nextCol++;
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          if (colIndex > 0) {
            nextCol--;
          } else if (rowIndex > 0) {
            nextRow--;
            nextCol = columns.length - 1;
          }
        } else {
          if (colIndex < columns.length - 1) {
            nextCol++;
          } else if (rowIndex < rows.length - 1) {
            nextRow++;
            nextCol = 0;
          }
        }
        break;
      case "Enter":
        e.preventDefault();
        const row = rows[rowIndex];
        const col = columns[colIndex];
        if (row && col) {
          const currentVal = row.values[col.columnId] || "";
          setEditingCell({ rowId: row.rowId, columnId: col.columnId, value: currentVal });
        }
        return;
      default:
        return;
    }

    setActiveCell({ rowIndex: nextRow, colIndex: nextCol });
  };

  return (
    <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(30,30,40,0.5)", backdropFilter: "blur(20px)", padding: "1px" }}>
      <table
        ref={tableRef}
        role="grid"
        aria-label="Spreadsheet Editor"
        tabIndex={0}
        onKeyDown={(e) => handleKeyDown(e, activeCell.rowIndex, activeCell.colIndex)}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "'Inter', sans-serif",
          fontSize: "14px",
          color: "#e2e8f0",
        }}
      >
        <thead>
          <tr role="row" style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)" }}>
            {columns.map((col, idx) => (
              <th
                key={col.columnId}
                role="columnheader"
                scope="col"
                style={{
                  padding: "12px 16px",
                  textAlign: idx === 0 ? "left" : "right",
                  fontWeight: 600,
                  color: "#94a3b8",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  fontSize: "11px",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={row.rowId}
              role="row"
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: rIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
              }}
            >
              {columns.map((col, cIdx) => {
                const cellId = `${row.rowId}:${col.columnId}`;
                const cmdState = commandStates.get(cellId);
                const displayVal = cmdState && cmdState.state !== "rejected" ? cmdState.value : (row.values[col.columnId] || "");

                // Determine classes/styles for visual states
                let cellBackground = "transparent";
                let cellBorder = "1px solid transparent";
                let tooltipText = "";

                if (cmdState) {
                  if (cmdState.state === "pending") {
                    cellBackground = "rgba(234, 179, 8, 0.15)"; // Yellow overlay
                    cellBorder = "1px solid #eab308";
                    tooltipText = "Submitting changes...";
                  } else if (cmdState.state === "committed") {
                    cellBackground = "rgba(34, 197, 94, 0.15)"; // Green overlay
                    cellBorder = "1px solid #22c55e";
                  } else if (cmdState.state === "rejected") {
                    cellBorder = "1px solid #ef4444"; // Red border
                    tooltipText = cmdState.error || "Rejected by server";
                  } else if (cmdState.state === "ambiguous_requires_refresh") {
                    cellBorder = "1px solid #f97316"; // Orange border
                    tooltipText = "Ambiguous outcome. Refresh workbook.";
                  }
                }

                const isActive = activeCell.rowIndex === rIdx && activeCell.colIndex === cIdx;
                if (isActive && !editingCell) {
                  cellBorder = "1px solid #3b82f6"; // Focused cell outline
                }

                const isEditing = editingCell && editingCell.rowId === row.rowId && editingCell.columnId === col.columnId;

                return (
                  <td
                    key={col.columnId}
                    role="gridcell"
                    aria-selected={isActive}
                    tabIndex={-1}
                    style={{
                      padding: "10px 16px",
                      textAlign: cIdx === 0 ? "left" : "right",
                      cursor: "cell",
                      position: "relative",
                      background: cellBackground,
                      border: cellBorder,
                      transition: "all 0.15s ease",
                      minWidth: "120px",
                    }}
                    onClick={() => handleCellClick(row.rowId, col.columnId, displayVal, rIdx, cIdx)}
                    title={tooltipText}
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => {
                          if (editHandledRef.current) {
                            editHandledRef.current = false;
                            return;
                          }

                          finishEditing("commit");
                        }}
                        style={{
                          width: "100%",
                          background: "rgba(0,0,0,0.5)",
                          border: "none",
                          outline: "2px solid #3b82f6",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          textAlign: cIdx === 0 ? "left" : "right",
                          fontFamily: "inherit",
                          fontSize: "inherit",
                        }}
                      />
                    ) : (
                      <span style={{ position: "relative", display: "inline-block", width: "100%" }}>
                        {displayVal}
                        {cmdState?.state === "pending" && (
                          <span
                            style={{
                              marginLeft: "8px",
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "#eab308",
                              animation: "pulse 1.5s infinite",
                            }}
                          />
                        )}
                      </span>
                    )}
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
