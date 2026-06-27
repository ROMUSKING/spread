/**
 * SpreadsheetGrid — AGENT-060
 *
 * A spreadsheet-style editable grid component with real spreadsheet interaction patterns:
 * - Row number gutter column
 * - Trailing empty row for natural data entry
 * - Trailing "+" column for adding new columns
 * - Double-click or Enter/F2 to edit; type-to-enter starts editing
 * - Tab wraps across rows and creates new rows at the boundary
 * - Enter commits and moves focus down
 * - Delete/Backspace clears a cell
 * - Frozen header row
 * - Row selection via gutter click
 * - Summary footer row for numeric columns
 *
 * All edits route through command_api via onCellEdit callback.
 *
 * @see docs/plan/vertical-slice-acceptance-checklist.md
 */
import { useState, useRef, useEffect, useCallback } from "react";

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
  onCreateRow: () => string; // Returns the new rowId
  onDeleteRow: (rowId: string) => void;
  onAddColumn: (columnId: string, label: string) => void;
  commandStates: Map<string, CommandState>; // key is "rowId:columnId"
  onGutterClick?: (rowIndex: number) => void;
};

// Styles as objects to keep the component self-contained
const COLORS = {
  headerBg: "rgba(15, 15, 25, 0.95)",
  headerText: "#8892a8",
  rowEven: "transparent",
  rowOdd: "rgba(255,255,255,0.015)",
  emptyRow: "rgba(255,255,255,0.02)",
  gutterBg: "rgba(15, 15, 25, 0.6)",
  gutterText: "#4a5568",
  gutterSelectedBg: "rgba(59, 130, 246, 0.15)",
  activeBorder: "#3b82f6",
  editOutline: "#3b82f6",
  pendingBg: "rgba(234, 179, 8, 0.15)",
  pendingBorder: "#eab308",
  committedBg: "rgba(34, 197, 94, 0.15)",
  committedBorder: "#22c55e",
  rejectedBorder: "#ef4444",
  ambiguousBorder: "#f97316",
  cellText: "#e2e8f0",
  footerBg: "rgba(15, 15, 25, 0.8)",
  footerText: "#94a3b8",
  addColBg: "rgba(255,255,255,0.03)",
  addColHover: "rgba(59, 130, 246, 0.1)",
  addColText: "#4a5568",
};

export function SpreadsheetGrid({
  rows,
  columns,
  onCellEdit,
  onCreateRow,
  onDeleteRow,
  onAddColumn,
  commandStates,
  onGutterClick,
}: SpreadsheetGridProps) {
  // ─── State ────────────────────────────────────────────────
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    value: string;
  } | null>(null);

  const [activeCell, setActiveCell] = useState<{
    rowIndex: number;
    colIndex: number;
  }>({ rowIndex: 0, colIndex: 0 });

  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const newColInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const editHandledRef = useRef(false);

  // The empty row always exists at position rows.length
  const emptyRowIndex = rows.length;
  const totalRowCount = rows.length + 1; // data rows + 1 empty row

  // ─── Effects ──────────────────────────────────────────────
  useEffect(() => {
    if (editingCell && inputRef.current) {
      editHandledRef.current = false;
      inputRef.current.focus();
      // Only select-all if the cell wasn't entered via type-to-enter
      // (type-to-enter sets value to the typed char, so length === 1)
      if (inputRef.current.value.length > 1) {
        inputRef.current.select();
      } else {
        // Place cursor at end for type-to-enter
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }
  }, [editingCell]);

  useEffect(() => {
    if (addingColumn && newColInputRef.current) {
      newColInputRef.current.focus();
    }
  }, [addingColumn]);

  // ─── Helpers ──────────────────────────────────────────────
  const getRowAt = useCallback(
    (rowIndex: number): GridRow | null => {
      if (rowIndex >= 0 && rowIndex < rows.length) return rows[rowIndex] ?? null;
      return null;
    },
    [rows]
  );

  const finishEditing = useCallback(
    (mode: "commit" | "cancel"): void => {
      if (!editingCell) return;
      editHandledRef.current = true;

      if (mode === "commit") {
        onCellEdit(editingCell.rowId, editingCell.columnId, editingCell.value);
      }

      setEditingCell(null);
      tableRef.current?.focus();
    },
    [editingCell, onCellEdit]
  );

  const enterEditMode = useCallback(
    (rowIndex: number, colIndex: number, initialValue?: string) => {
      let row = getRowAt(rowIndex);

      // If editing the empty row, create a new row first
      if (!row && rowIndex === emptyRowIndex) {
        const newRowId = onCreateRow();
        // The new row will be at the current emptyRowIndex.
        // We start editing with the provided initial value or empty string.
        row = { rowId: newRowId, values: {} };
      }

      if (!row) return;
      const col = columns[colIndex];
      if (!col) return;

      const currentVal = initialValue !== undefined ? initialValue : (row.values[col.columnId] || "");
      setEditingCell({ rowId: row.rowId, columnId: col.columnId, value: currentVal });
    },
    [getRowAt, emptyRowIndex, onCreateRow, columns]
  );

  const moveFocus = useCallback(
    (nextRow: number, nextCol: number) => {
      // Clamp within bounds (include empty row)
      const clampedRow = Math.max(0, Math.min(nextRow, emptyRowIndex));
      const clampedCol = Math.max(0, Math.min(nextCol, columns.length - 1));
      setActiveCell({ rowIndex: clampedRow, colIndex: clampedCol });
      setSelectedRow(null);
    },
    [emptyRowIndex, columns.length]
  );

  // ─── Cell Click Handlers ──────────────────────────────────
  const handleCellClick = (rowIndex: number, colIndex: number) => {
    setActiveCell({ rowIndex, colIndex });
    setSelectedRow(null);
    // Single click just selects — does NOT enter edit mode
  };

  const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
    setActiveCell({ rowIndex, colIndex });
    setSelectedRow(null);
    enterEditMode(rowIndex, colIndex);
  };

  const handleGutterClick = (rowIndex: number) => {
    if (rowIndex < rows.length) {
      setSelectedRow(rowIndex);
      setActiveCell({ rowIndex, colIndex: 0 });
      if (onGutterClick) {
        onGutterClick(rowIndex);
      }
    }
  };

  // ─── Keyboard Handler ─────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const { rowIndex, colIndex } = activeCell;

    // ── While Editing ──────────────
    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        finishEditing("commit");
        // Move focus to next column/wrap after Enter commit
        if (colIndex < columns.length - 1) {
          moveFocus(rowIndex, colIndex + 1);
        } else {
          moveFocus(rowIndex + 1, 0);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishEditing("cancel");
      } else if (e.key === "Tab") {
        e.preventDefault();
        finishEditing("commit");
        // Tab: move right, wrap to next row
        if (e.shiftKey) {
          if (colIndex > 0) {
            moveFocus(rowIndex, colIndex - 1);
          } else if (rowIndex > 0) {
            moveFocus(rowIndex - 1, columns.length - 1);
          }
        } else {
          if (colIndex < columns.length - 1) {
            moveFocus(rowIndex, colIndex + 1);
          } else {
            // Tab past last column → next row first column
            // If we're on the last data row or the empty row, this creates a new row on next type
            moveFocus(rowIndex + 1, 0);
          }
        }
      }
      return;
    }

    // ── Row Selection Mode ──────────
    if (selectedRow !== null) {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const row = getRowAt(selectedRow);
        if (row) {
          onDeleteRow(row.rowId);
          setSelectedRow(null);
          // Keep focus at same position or move up
          const nextRowIdx = Math.min(selectedRow, rows.length - 2);
          moveFocus(Math.max(0, nextRowIdx), 0);
        }
        return;
      }
      if (e.key === "Escape") {
        setSelectedRow(null);
        return;
      }
    }

    // ── Grid Navigation Mode ────────
    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (rowIndex > 0) nextRow--;
        break;
      case "ArrowDown":
        e.preventDefault();
        if (rowIndex < emptyRowIndex) nextRow++;
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
          } else {
            nextRow = Math.min(rowIndex + 1, emptyRowIndex);
            nextCol = 0;
          }
        }
        break;
      case "Enter":
        e.preventDefault();
        if (colIndex < columns.length - 1) {
          moveFocus(rowIndex, colIndex + 1);
        } else {
          moveFocus(rowIndex + 1, 0);
        }
        return;
      case "F2":
        e.preventDefault();
        enterEditMode(rowIndex, colIndex);
        return;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        {
          const row = getRowAt(rowIndex);
          const col = columns[colIndex];
          if (row && col && row.values[col.columnId]) {
            onCellEdit(row.rowId, col.columnId, "");
          }
        }
        return;
      default:
        // Type-to-enter: if a printable character is typed, start editing with that character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          enterEditMode(rowIndex, colIndex, e.key);
          return;
        }
        return;
    }

    setSelectedRow(null);
    setActiveCell({ rowIndex: nextRow, colIndex: nextCol });
  };

  // ─── Add Column ───────────────────────────────────────────
  const handleAddColumnSubmit = () => {
    const trimmed = newColumnName.trim();
    if (trimmed) {
      const columnId = trimmed.toLowerCase().replace(/\s+/g, "_");
      const label = trimmed;
      onAddColumn(columnId, label);
    }
    setNewColumnName("");
    setAddingColumn(false);
    tableRef.current?.focus();
  };

  // ─── Numeric Summary Computation ──────────────────────────
  const columnSums: Record<string, number | null> = {};
  for (const col of columns) {
    let sum = 0;
    let hasNumeric = false;
    for (const row of rows) {
      const val = row.values[col.columnId];
      if (val !== undefined && val !== "") {
        const num = Number(val);
        if (Number.isFinite(num)) {
          sum += num;
          hasNumeric = true;
        }
      }
    }
    columnSums[col.columnId] = hasNumeric ? sum : null;
  }

  // ─── Render ───────────────────────────────────────────────
  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(30,30,40,0.5)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
        <table
          ref={tableRef}
          role="grid"
          aria-label="Spreadsheet Editor"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'Inter', sans-serif",
            fontSize: "14px",
            color: COLORS.cellText,
          }}
        >
          {/* ── Frozen Header ────────────────────────────── */}
          <thead>
            <tr
              role="row"
              style={{
                borderBottom: "2px solid rgba(255,255,255,0.1)",
                background: COLORS.headerBg,
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              {/* Row number header */}
              <th
                scope="col"
                style={{
                  padding: "12px 8px",
                  textAlign: "center",
                  fontWeight: 600,
                  color: COLORS.headerText,
                  fontSize: "11px",
                  width: "48px",
                  minWidth: "48px",
                  borderRight: "1px solid rgba(255,255,255,0.08)",
                  position: "sticky",
                  left: 0,
                  background: COLORS.headerBg,
                  zIndex: 11,
                }}
              >
                #
              </th>
              {/* Data columns */}
              {columns.map((col, idx) => (
                <th
                  key={col.columnId}
                  role="columnheader"
                  scope="col"
                  style={{
                    padding: "12px 16px",
                    textAlign: idx === 0 ? "left" : "right",
                    fontWeight: 600,
                    color: COLORS.headerText,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontSize: "11px",
                    minWidth: "120px",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  {col.label}
                </th>
              ))}
              {/* Add column header */}
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "center",
                  width: "48px",
                  minWidth: "48px",
                  cursor: "pointer",
                  color: COLORS.addColText,
                  background: addingColumn ? COLORS.addColHover : COLORS.addColBg,
                  transition: "background 0.15s",
                  fontSize: "16px",
                  fontWeight: 400,
                }}
                onClick={() => setAddingColumn(true)}
                title="Add column"
              >
                {addingColumn ? (
                  <input
                    ref={newColInputRef}
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddColumnSubmit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setNewColumnName("");
                        setAddingColumn(false);
                        tableRef.current?.focus();
                      }
                    }}
                    onBlur={handleAddColumnSubmit}
                    placeholder="Name..."
                    style={{
                      width: "80px",
                      background: "rgba(0,0,0,0.5)",
                      border: "none",
                      outline: `2px solid ${COLORS.activeBorder}`,
                      color: "#fff",
                      padding: "4px 6px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      textTransform: "none",
                      letterSpacing: "normal",
                    }}
                  />
                ) : (
                  "+"
                )}
              </th>
            </tr>
          </thead>

          {/* ── Data Rows + Empty Row ────────────────────── */}
          <tbody>
            {Array.from({ length: totalRowCount }, (_, rIdx) => {
              const row = getRowAt(rIdx);
              const isEmptyRow = rIdx === emptyRowIndex;
              const isRowSelected = selectedRow === rIdx;
              const displayRowNum = rIdx + 1;

              return (
                <tr
                  key={row ? row.rowId : "__empty__"}
                  role="row"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: isRowSelected
                      ? COLORS.gutterSelectedBg
                      : isEmptyRow
                      ? COLORS.emptyRow
                      : rIdx % 2 === 0
                      ? COLORS.rowEven
                      : COLORS.rowOdd,
                    transition: "background 0.1s",
                  }}
                >
                  {/* Row number gutter */}
                  <td
                    onClick={() => handleGutterClick(rIdx)}
                    style={{
                      padding: "10px 8px",
                      textAlign: "center",
                      color: isRowSelected ? COLORS.activeBorder : COLORS.gutterText,
                      fontSize: "12px",
                      fontWeight: isRowSelected ? 700 : 400,
                      cursor: isEmptyRow ? "default" : "pointer",
                      userSelect: "none",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      background: isRowSelected
                        ? COLORS.gutterSelectedBg
                        : COLORS.gutterBg,
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      width: "48px",
                      minWidth: "48px",
                    }}
                    title={isEmptyRow ? "" : `Select row ${displayRowNum}`}
                  >
                    {isEmptyRow ? "" : displayRowNum}
                  </td>

                  {/* Data cells */}
                  {columns.map((col, cIdx) => {
                    const rowId = row?.rowId || "__empty__";
                    const cellId = `${rowId}:${col.columnId}`;
                    const cmdState = commandStates.get(cellId);
                    const rawVal = row?.values[col.columnId] || "";
                    const displayVal =
                      cmdState && cmdState.state !== "rejected"
                        ? cmdState.value
                        : rawVal;

                    // Visual state
                    let cellBackground = "transparent";
                    let cellBorder = "1px solid transparent";
                    let tooltipText = "";

                    if (cmdState) {
                      if (cmdState.state === "pending") {
                        cellBackground = COLORS.pendingBg;
                        cellBorder = `1px solid ${COLORS.pendingBorder}`;
                        tooltipText = "Submitting changes...";
                      } else if (cmdState.state === "committed") {
                        cellBackground = COLORS.committedBg;
                        cellBorder = `1px solid ${COLORS.committedBorder}`;
                      } else if (cmdState.state === "rejected") {
                        cellBorder = `1px solid ${COLORS.rejectedBorder}`;
                        tooltipText = cmdState.error || "Rejected by server";
                      } else if (
                        cmdState.state === "ambiguous_requires_refresh"
                      ) {
                        cellBorder = `1px solid ${COLORS.ambiguousBorder}`;
                        tooltipText = "Ambiguous outcome. Refresh workbook.";
                      }
                    }

                    const isActive =
                      activeCell.rowIndex === rIdx &&
                      activeCell.colIndex === cIdx &&
                      selectedRow === null;
                    if (isActive && !editingCell) {
                      cellBorder = `2px solid ${COLORS.activeBorder}`;
                    }

                    const isEditing =
                      editingCell &&
                      editingCell.rowId === rowId &&
                      editingCell.columnId === col.columnId;

                    return (
                      <td
                        key={col.columnId}
                        role="gridcell"
                        aria-selected={isActive}
                        tabIndex={-1}
                        style={{
                          padding: isActive && !editingCell ? "9px 15px" : "10px 16px",
                          textAlign: cIdx === 0 ? "left" : "right",
                          cursor: "cell",
                          position: "relative",
                          background: cellBackground,
                          border: cellBorder,
                          transition: "all 0.1s ease",
                          minWidth: "120px",
                          color: isEmptyRow && !isEditing ? COLORS.gutterText : COLORS.cellText,
                          fontStyle: isEmptyRow && !isEditing ? "italic" : "normal",
                        }}
                        onClick={() => handleCellClick(rIdx, cIdx)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rIdx, cIdx)
                        }
                        title={tooltipText}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editingCell.value}
                            onChange={(e) =>
                              setEditingCell({
                                ...editingCell,
                                value: e.target.value,
                              })
                            }
                            onBlur={() => {
                              if (editHandledRef.current) {
                                editHandledRef.current = false;
                                return;
                              }
                              finishEditing("commit");
                            }}
                            onKeyDown={(e) => {
                              // Let the table-level handler deal with Enter/Escape/Tab
                              // but we need to stop propagation for normal typing
                              if (
                                e.key !== "Enter" &&
                                e.key !== "Escape" &&
                                e.key !== "Tab"
                              ) {
                                e.stopPropagation();
                              }
                            }}
                            style={{
                              width: "100%",
                              background: "rgba(0,0,0,0.5)",
                              border: "none",
                              outline: `2px solid ${COLORS.editOutline}`,
                              color: "#fff",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              textAlign: cIdx === 0 ? "left" : "right",
                              fontFamily: "inherit",
                              fontSize: "inherit",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              position: "relative",
                              display: "inline-block",
                              width: "100%",
                            }}
                          >
                            {isEmptyRow && !displayVal
                              ? cIdx === 0
                                ? "Type to add row..."
                                : ""
                              : displayVal}
                            {cmdState?.state === "pending" && (
                              <span
                                className="spread-pulse"
                                style={{
                                  marginLeft: "8px",
                                  display: "inline-block",
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  background: COLORS.pendingBorder,
                                }}
                              />
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Empty cell in the "+" column */}
                  <td
                    style={{
                      padding: "10px 16px",
                      minWidth: "48px",
                      background: COLORS.addColBg,
                    }}
                  />
                </tr>
              );
            })}
          </tbody>

          {/* ── Summary Footer ───────────────────────────── */}
          {rows.length > 0 && (
            <tfoot>
              <tr
                style={{
                  borderTop: "2px solid rgba(255,255,255,0.1)",
                  background: COLORS.footerBg,
                  position: "sticky",
                  bottom: 0,
                }}
              >
                {/* Gutter footer */}
                <td
                  style={{
                    padding: "10px 8px",
                    textAlign: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: COLORS.footerText,
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    position: "sticky",
                    left: 0,
                    background: COLORS.footerBg,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Σ
                </td>
                {columns.map((col, cIdx) => {
                  const sum = columnSums[col.columnId] ?? null;
                  return (
                    <td
                      key={col.columnId}
                      style={{
                        padding: "10px 16px",
                        textAlign: cIdx === 0 ? "left" : "right",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: sum !== null ? COLORS.cellText : COLORS.gutterText,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {sum !== null
                        ? cIdx === 0
                          ? `${rows.length} items`
                          : sum % 1 === 0
                          ? sum.toLocaleString()
                          : sum.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                        : ""}
                    </td>
                  );
                })}
                {/* "+" column footer */}
                <td
                  style={{
                    padding: "10px 16px",
                    minWidth: "48px",
                    background: COLORS.addColBg,
                  }}
                />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
