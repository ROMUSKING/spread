/**
 * Spreadsheet grid: cell edits route through onCellEdit → command_api.
 * Column widths are client-only preferences (localStorage); not server mutations.
 */
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { List, type RowComponentProps } from "react-window";
import type { GridColumn } from "@erp/contracts/grid-column";
import { cellStatusClass, resolveColumnWidth as resolveWidth } from "../lib/gridUtils";
import {
  formatDisplayValue,
  isColumnEditable,
  protectedCellTitle,
} from "../lib/columnMetaUtils";
import { EMPTY_STATE_COPY } from "../lib/emptyStateCopy";
import {
  applySalesOrderCollapse,
  isSalesOrderHeaderRow,
  lineCountForGroup,
  salesOrderGroupKey,
  shouldGroupSalesOrders,
  summarizeSalesOrderHeader,
  toggleCollapsedGroup,
} from "../lib/salesOrderGrouping";
import {
  shouldVirtualizeGrid,
  VIRTUAL_ROW_HEIGHT,
} from "../lib/gridVirtualization";
import { CellValueEditor } from "@erp/ui/CellValueEditor";

export type { GridColumn };

type VirtualRowProps = {
  renderBodyRow: (rIdx: number) => ReactNode;
};

function SpreadsheetVirtualRow({
  index,
  style,
  renderBodyRow,
}: RowComponentProps<VirtualRowProps>) {
  return (
    <div style={style} className="spreadsheet-virtual-row-host">
      <table className="spreadsheet-table spreadsheet-table--virtual-slice">
        <tbody>{renderBodyRow(index)}</tbody>
      </table>
    </div>
  );
}

export type CommandState = {
  state: "pending" | "committed" | "rejected" | "ambiguous_requires_refresh";
  value: string;
  error?: string | undefined;
};

export type GridRow = {
  rowId: string;
  values: Record<string, string>;
};

export type SpreadsheetGridProps = {
  rows: GridRow[];
  columns: GridColumn[];
  workbookId?: string;
  onCellEdit: (rowId: string, columnId: string, value: string) => void;
  onCreateRow: () => string;
  onDeleteRow: (rowId: string) => void;
  onAddColumn: (columnId: string, label: string) => void;
  commandStates: Map<string, CommandState>;
  onGutterClick?: (rowIndex: number) => void;
  getColumnWidth?: (workbookId: string, columnId: string) => number | undefined;
  onColumnWidthChange?: (workbookId: string, columnId: string, width: number) => void;
};

export function SpreadsheetGrid({
  rows,
  columns,
  workbookId,
  onCellEdit,
  onCreateRow,
  onDeleteRow,
  onAddColumn,
  commandStates,
  onGutterClick,
  getColumnWidth,
  onColumnWidthChange,
}: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnId: string;
    value: string;
  } | null>(null);

  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colIndex: number }>({
    rowIndex: 0,
    colIndex: 0,
  });

  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [draftWidths, setDraftWidths] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionStart, setSelectionStart] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const newColInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const editHandledRef = useRef(false);
  const resizeStartRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const draftWidthsRef = useRef<Record<string, number>>({});
  const resizePointerIdRef = useRef<number | null>(null);
  const resizeHandleRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(320);

  const groupingEnabled = shouldGroupSalesOrders(workbookId, rows);
  const groupedRows = groupingEnabled ? applySalesOrderCollapse(rows, collapsedGroups) : rows;

  const filteredRows = searchQuery
    ? groupedRows.filter((row) =>
        Object.values(row.values).some((val) =>
          String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : groupedRows;

  const emptyRowIndex = filteredRows.length;
  const totalRowCount = filteredRows.length + 1;
  const useVirtualizedBody = shouldVirtualizeGrid(totalRowCount);
  const canResize = Boolean(workbookId && onColumnWidthChange);

  useEffect(() => {
    if (!useVirtualizedBody) return;
    const el = scrollRef.current;
    if (!el) return;

    const updateHeight = () => {
      const next = Math.max(160, el.clientHeight - 8);
      setListHeight(next);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [useVirtualizedBody]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      editHandledRef.current = false;
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingCell]);

  useEffect(() => {
    if (addingColumn && newColInputRef.current) {
      newColInputRef.current.focus();
    }
  }, [addingColumn]);

  const handleCellMouseDown = (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
    if (e.button !== 0 || editingCell || resizingColumn) return;
    setIsSelecting(true);
    setSelectionStart({ rowIndex, colIndex });
    setSelectionEnd({ rowIndex, colIndex });
    setActiveCell({ rowIndex, colIndex });
    setSelectedRow(null);
  };

  const handleCellMouseEnter = (rowIndex: number, colIndex: number) => {
    if (!isSelecting) return;
    setSelectionEnd({ rowIndex, colIndex });
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsSelecting(false);
    };
    window.addEventListener("mouseup", handleMouseUpGlobal);
    return () => window.removeEventListener("mouseup", handleMouseUpGlobal);
  }, [isSelecting]);

  const isCellSelected = useCallback((rowIndex: number, colIndex: number) => {
    if (!selectionStart || !selectionEnd) {
      return activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex;
    }
    const minRow = Math.min(selectionStart.rowIndex, selectionEnd.rowIndex);
    const maxRow = Math.max(selectionStart.rowIndex, selectionEnd.rowIndex);
    const minCol = Math.min(selectionStart.colIndex, selectionEnd.colIndex);
    const maxCol = Math.max(selectionStart.colIndex, selectionEnd.colIndex);
    return rowIndex >= minRow && rowIndex <= maxRow && colIndex >= minCol && colIndex <= maxCol;
  }, [selectionStart, selectionEnd, activeCell]);

  const getCellRangeClasses = useCallback((rowIndex: number, colIndex: number) => {
    if (!selectionStart || !selectionEnd) return "";
    const minRow = Math.min(selectionStart.rowIndex, selectionEnd.rowIndex);
    const maxRow = Math.max(selectionStart.rowIndex, selectionEnd.rowIndex);
    const minCol = Math.min(selectionStart.colIndex, selectionEnd.colIndex);
    const maxCol = Math.max(selectionStart.colIndex, selectionEnd.colIndex);

    if (rowIndex < minRow || rowIndex > maxRow || colIndex < minCol || colIndex > maxCol) return "";

    const classes = ["spreadsheet-cell--in-range"];
    if (rowIndex === minRow) classes.push("spreadsheet-cell--range-top");
    if (rowIndex === maxRow) classes.push("spreadsheet-cell--range-bottom");
    if (colIndex === minCol) classes.push("spreadsheet-cell--range-left");
    if (colIndex === maxCol) classes.push("spreadsheet-cell--range-right");

    return classes.join(" ");
  }, [selectionStart, selectionEnd]);

  const finishResize = useCallback(() => {
    const start = resizeStartRef.current;
    if (start && workbookId && onColumnWidthChange) {
      const finalWidth = draftWidthsRef.current[start.columnId] ?? start.startWidth;
      onColumnWidthChange(workbookId, start.columnId, finalWidth);
    }
    if (resizeHandleRef.current && resizePointerIdRef.current !== null) {
      try {
        resizeHandleRef.current.releasePointerCapture(resizePointerIdRef.current);
      } catch {
        // pointer may already be released
      }
    }
    resizePointerIdRef.current = null;
    resizeHandleRef.current = null;
    setResizingColumn(null);
    setDraftWidths({});
    draftWidthsRef.current = {};
    resizeStartRef.current = null;
    document.body.classList.remove("spreadsheet-resizing");
  }, [workbookId, onColumnWidthChange]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handlePointerMove = (e: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const width = start.startWidth + (e.clientX - start.startX);
      draftWidthsRef.current[start.columnId] = width;
      setDraftWidths((prev) => ({ ...prev, [start.columnId]: width }));
    };

    const handlePointerUp = () => finishResize();
    const handlePointerCancel = () => finishResize();
    const handleBlur = () => finishResize();

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleBlur);
      document.body.classList.remove("spreadsheet-resizing");
    };
  }, [resizingColumn, finishResize]);

  const resolveColumnWidth = useCallback(
    (columnId: string): number =>
      resolveWidth(columnId, workbookId, getColumnWidth, draftWidths),
    [workbookId, getColumnWidth, draftWidths]
  );

  const startColumnResize = (columnId: string, e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canResize || !workbookId) return;
    resizeHandleRef.current = e.currentTarget;
    resizePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizingColumn(columnId);
    document.body.classList.add("spreadsheet-resizing");
    resizeStartRef.current = {
      columnId,
      startX: e.clientX,
      startWidth: resolveColumnWidth(columnId),
    };
    draftWidthsRef.current = {};
  };

  const getRowAt = useCallback(
    (rowIndex: number): GridRow | null => {
      if (rowIndex >= 0 && rowIndex < filteredRows.length) return filteredRows[rowIndex] ?? null;
      return null;
    },
    [filteredRows]
  );

  const finishEditing = useCallback(
    (mode: "commit" | "cancel"): void => {
      if (!editingCell) return;
      editHandledRef.current = true;

      if (mode === "commit") {
        let targetRowId = editingCell.rowId;
        if (targetRowId === "__new_row__") {
          targetRowId = onCreateRow();
        }
        onCellEdit(targetRowId, editingCell.columnId, editingCell.value);
      }

      setEditingCell(null);
      (useVirtualizedBody ? keyboardRef : tableRef).current?.focus();
    },
    [editingCell, onCellEdit, onCreateRow, useVirtualizedBody]
  );

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (editingCell || document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      const start = selectionStart || activeCell;
      const end = selectionEnd || activeCell;
      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const minCol = Math.min(start.colIndex, end.colIndex);
      const maxCol = Math.max(start.colIndex, end.colIndex);

      let lines: string[] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row = getRowAt(r);
        if (!row) continue;
        const lineCells: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const col = columns[c];
          if (!col) continue;
          lineCells.push(row.values[col.columnId] || "");
        }
        lines.push(lineCells.join("\t"));
      }

      const tsvText = lines.join("\n");
      e.clipboardData?.setData("text/plain", tsvText);
      e.preventDefault();
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (editingCell || document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      const rawText = e.clipboardData?.getData("text/plain") || "";
      if (!rawText) return;

      const lines = rawText.split(/\r?\n/);
      if (lines.length === 0) return;

      const start = selectionStart || activeCell;
      const baseRow = start.rowIndex;
      const baseCol = start.colIndex;

      e.preventDefault();

      for (let rIdx = 0; rIdx < lines.length; rIdx++) {
        const line = lines[rIdx];
        if (line === undefined) continue;
        if (!line && rIdx === lines.length - 1) continue;
        const cells = line.split("\t");
        const targetRowIdx = baseRow + rIdx;
        const row = getRowAt(targetRowIdx);
        if (!row) continue;

        for (let cIdx = 0; cIdx < cells.length; cIdx++) {
          const val = cells[cIdx];
          if (val === undefined) continue;
          const targetColIdx = baseCol + cIdx;
          const col = columns[targetColIdx];
          if (!col) continue;
          
          onCellEdit(row.rowId, col.columnId, val);
        }
      }
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  }, [selectionStart, selectionEnd, activeCell, editingCell, columns, getRowAt, onCellEdit]);

  const enterEditMode = useCallback(
    (rowIndex: number, colIndex: number, initialValue?: string) => {
      const row = getRowAt(rowIndex);

      if (!row && rowIndex === emptyRowIndex) {
        const currentVal = initialValue !== undefined ? initialValue : "";
        setEditingCell({
          rowId: "__new_row__",
          columnId: columns[colIndex]?.columnId || "",
          value: currentVal,
        });
        return;
      }

      if (!row) return;
      const col = columns[colIndex];
      if (!col || !isColumnEditable(col)) return;

      const currentVal =
        initialValue !== undefined ? initialValue : row.values[col.columnId] || "";
      setEditingCell({ rowId: row.rowId, columnId: col.columnId, value: currentVal });
    },
    [getRowAt, emptyRowIndex, columns]
  );

  const moveFocus = useCallback(
    (nextRow: number, nextCol: number) => {
      const clampedRow = Math.max(0, Math.min(nextRow, emptyRowIndex));
      const clampedCol = Math.max(0, Math.min(nextCol, columns.length - 1));
      setActiveCell({ rowIndex: clampedRow, colIndex: clampedCol });
      setSelectedRow(null);
    },
    [emptyRowIndex, columns.length]
  );

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    if (resizingColumn !== null) return;
    setActiveCell({ rowIndex, colIndex });
    setSelectedRow(null);
  };

  const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
    if (resizingColumn !== null) return;
    setActiveCell({ rowIndex, colIndex });
    setSelectedRow(null);
    enterEditMode(rowIndex, colIndex);
  };

  const handleGroupToggle = (groupKey: string) => {
    setCollapsedGroups((prev) => toggleCollapsedGroup(prev, groupKey));
  };

  const handleGutterClick = (rowIndex: number, row: GridRow | null) => {
    if (!row || rowIndex >= filteredRows.length) return;

    const groupKey = groupingEnabled ? salesOrderGroupKey(row.rowId) : null;
    if (groupKey && isSalesOrderHeaderRow(row.rowId)) {
      handleGroupToggle(groupKey);
      return;
    }

    setSelectedRow(rowIndex);
    setActiveCell({ rowIndex, colIndex: 0 });
    onGutterClick?.(rowIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (resizingColumn !== null) return;

    const { rowIndex, colIndex } = activeCell;

    if (editingCell) {
      if (e.key === "Enter") {
        e.preventDefault();
        const wasNew = editingCell?.rowId === "__new_row__";
        finishEditing("commit");
        const targetRow = rowIndex + 1;
        if (wasNew) {
          setActiveCell({ rowIndex: targetRow, colIndex });
          setSelectedRow(null);
        } else {
          moveFocus(targetRow, colIndex);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishEditing("cancel");
      } else if (e.key === "Tab") {
        e.preventDefault();
        finishEditing("commit");
        if (e.shiftKey) {
          if (colIndex > 0) {
            moveFocus(rowIndex, colIndex - 1);
          } else if (rowIndex > 0) {
            moveFocus(rowIndex - 1, columns.length - 1);
          }
        } else if (colIndex < columns.length - 1) {
          moveFocus(rowIndex, colIndex + 1);
        } else {
          moveFocus(rowIndex + 1, 0);
        }
      }
      return;
    }

    if (selectedRow !== null) {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const row = getRowAt(selectedRow);
        if (row) {
          onDeleteRow(row.rowId);
          setSelectedRow(null);
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
        } else if (colIndex < columns.length - 1) {
          nextCol++;
        } else {
          nextRow = Math.min(rowIndex + 1, emptyRowIndex);
          nextCol = 0;
        }
        break;
      case "Enter":
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
          if (row && col && isColumnEditable(col) && row.values[col.columnId]) {
            onCellEdit(row.rowId, col.columnId, "");
          }
        }
        return;
      default:
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

  const handleAddColumnSubmit = () => {
    const trimmed = newColumnName.trim();
    if (trimmed) {
      const columnId = trimmed.toLowerCase().replace(/\s+/g, "_");
      onAddColumn(columnId, trimmed);
    }
    setNewColumnName("");
    setAddingColumn(false);
    (useVirtualizedBody ? keyboardRef : tableRef).current?.focus();
  };

  const columnSums: Record<string, number | null> = {};
  for (const col of columns) {
    let sum = 0;
    let hasNumeric = false;
    const treatAsNumeric = col.type === "number" || col.format === "currency";
    for (const row of rows) {
      const val = row.values[col.columnId];
      if (val !== undefined && val !== "") {
        const num = Number(val);
        if (Number.isFinite(num) && (treatAsNumeric || !col.type)) {
          sum += num;
          hasNumeric = true;
        }
      }
    }
    columnSums[col.columnId] = hasNumeric ? sum : null;
  }

  const renderBodyRow = useCallback(
    (rIdx: number): ReactNode => {
      const row = getRowAt(rIdx);
      const isEmptyRow = rIdx === emptyRowIndex;
      const isRowSelected = selectedRow === rIdx;
      const displayRowNum = rIdx + 1;
      const isGroupHeader = !!row && groupingEnabled && isSalesOrderHeaderRow(row.rowId);
      const groupKey = row && groupingEnabled ? salesOrderGroupKey(row.rowId) : null;
      const isCollapsed = groupKey ? collapsedGroups.has(groupKey) : false;
      const lineCount = groupKey && isGroupHeader ? lineCountForGroup(rows, groupKey) : 0;

      return (
        <tr
          key={row ? row.rowId : "__empty__"}
          role="row"
          className={isGroupHeader ? "spreadsheet-row--group-header" : undefined}
          style={{
            background: isGroupHeader
              ? "var(--color-bg-elevated)"
              : isRowSelected
              ? "var(--color-bg-active)"
              : isEmptyRow
              ? "var(--color-bg-muted)"
              : rIdx % 2 === 1
              ? "var(--color-bg-muted)"
              : "transparent",
          }}
        >
          <td
            className={`spreadsheet-gutter ${isGroupHeader ? "spreadsheet-gutter--group" : ""}`}
            onClick={() => handleGutterClick(rIdx, row)}
            style={{
              cursor: isEmptyRow ? "default" : "pointer",
              fontWeight: isRowSelected || isGroupHeader ? 600 : 400,
              color: isRowSelected ? "var(--color-accent)" : "var(--color-text-muted)",
            }}
            title={
              isEmptyRow
                ? undefined
                : isGroupHeader
                ? `${isCollapsed ? "Expand" : "Collapse"} order ${groupKey} (${lineCount} lines)`
                : `Select row ${displayRowNum}`
            }
          >
            {isEmptyRow ? (
              ""
            ) : isGroupHeader ? (
              <span className="spreadsheet-group-toggle" aria-hidden="true">
                {isCollapsed ? "▶" : "▼"}
              </span>
            ) : (
              displayRowNum
            )}
          </td>

          {columns.map((col, cIdx) => {
            const rowId = row?.rowId || "__empty__";
            const wb = workbookId || "";
            const cellId = wb ? `${wb}:${rowId}:${col.columnId}` : `${rowId}:${col.columnId}`;
            const cmdState = commandStates.get(cellId);
            const rawVal = row?.values[col.columnId] || "";
            const displayVal =
              cmdState && cmdState.state !== "rejected" ? cmdState.value : rawVal;

            const isActive =
              activeCell.rowIndex === rIdx &&
              activeCell.colIndex === cIdx &&
              selectedRow === null;

            const isEditing =
              editingCell &&
              (editingCell.rowId === rowId ||
                (editingCell.rowId === "__new_row__" && isEmptyRow)) &&
              editingCell.columnId === col.columnId;

            const width = resolveColumnWidth(col.columnId);
            const statusClass = cellStatusClass(cmdState?.state);
            const editable = isColumnEditable(col);
            const protectedTitle = protectedCellTitle(col);
            const tooltipText =
              protectedTitle ||
              (cmdState?.state === "pending"
                ? "Saving"
                : cmdState?.state === "rejected"
                ? cmdState.error || "Rejected"
                : cmdState?.state === "ambiguous_requires_refresh"
                ? "Refresh required"
                : "");

            const rangeClasses = getCellRangeClasses(rIdx, cIdx);
            const formattedDisplay =
              !isEditing && displayVal ? formatDisplayValue(displayVal, col) : displayVal;

            return (
              <td
                key={col.columnId}
                role="gridcell"
                aria-selected={isActive}
                tabIndex={-1}
                className={`spreadsheet-cell ${statusClass} ${isActive && !editingCell ? "spreadsheet-cell--active" : ""} ${!editable ? "spreadsheet-cell--protected" : ""} ${rangeClasses}`}
                style={{
                  minWidth: width,
                  width,
                  textAlign: cIdx === 0 ? "left" : "right",
                  color: isEmptyRow && !isEditing ? "var(--color-text-muted)" : "var(--color-text)",
                  fontStyle: isEmptyRow && !isEditing ? "italic" : "normal",
                }}
                onMouseDown={(e) => handleCellMouseDown(rIdx, cIdx, e)}
                onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                onClick={() => handleCellClick(rIdx, cIdx)}
                onDoubleClick={() => handleCellDoubleClick(rIdx, cIdx)}
                title={tooltipText}
              >
                {isEditing && editable ? (
                  <CellValueEditor
                    column={col}
                    value={editingCell.value}
                    editing
                    onChange={(next) => setEditingCell({ ...editingCell, value: next })}
                    onCommit={() => {
                      if (editHandledRef.current) {
                        editHandledRef.current = false;
                        return;
                      }
                      finishEditing("commit");
                    }}
                    onCancel={() => finishEditing("cancel")}
                    inputRef={inputRef}
                    textAlign={cIdx === 0 ? "left" : "right"}
                    stopPropagationOnKey
                  />
                ) : (
                  <span style={{ display: "inline-block", width: "100%" }}>
                    {isGroupHeader && cIdx === 0 && !isEditing ? (
                      <span className="spreadsheet-group-summary">
                        <span className="spreadsheet-group-summary__title">
                          {summarizeSalesOrderHeader(row!)}
                        </span>
                        <span className="spreadsheet-group-summary__meta">
                          {lineCount} line{lineCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : isEmptyRow && !displayVal ? (
                      cIdx === 0 ? (
                        "Type to add row"
                      ) : (
                        ""
                      )
                    ) : (
                      formattedDisplay
                    )}
                    {!editable && !isEmptyRow && (
                      <span className="spreadsheet-cell__lock" aria-hidden="true" title={protectedTitle}>
                        🔒
                      </span>
                    )}
                    {cmdState?.state === "pending" && (
                      <span className="status-dot status-dot--pending" aria-label="pending" />
                    )}
                    {cmdState?.state === "ambiguous_requires_refresh" && (
                      <span className="status-dot status-dot--ambiguous" aria-label="ambiguous" />
                    )}
                    {cmdState?.state === "rejected" && (
                      <span className="status-dot status-dot--rejected" aria-label="rejected" />
                    )}
                  </span>
                )}
              </td>
            );
          })}

          <td style={{ minWidth: 48, background: "var(--color-bg-muted)" }} />
        </tr>
      );
    },
    [
      getRowAt,
      emptyRowIndex,
      selectedRow,
      groupingEnabled,
      collapsedGroups,
      rows,
      columns,
      workbookId,
      commandStates,
      activeCell,
      editingCell,
      resolveColumnWidth,
      getCellRangeClasses,
      handleGutterClick,
      handleCellMouseDown,
      handleCellMouseEnter,
      handleCellClick,
      handleCellDoubleClick,
      finishEditing,
    ]
  );

  const renderTableHead = () => (
    <thead className="spreadsheet-header">
      <tr role="row">
        <th scope="col" className="spreadsheet-gutter">
          #
        </th>
        {columns.map((col, idx) => {
          const width = resolveColumnWidth(col.columnId);
          return (
            <th
              key={col.columnId}
              role="columnheader"
              scope="col"
              style={{
                minWidth: width,
                width,
                textAlign: idx === 0 ? "left" : "right",
              }}
            >
              {col.label}
              {canResize && (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${col.label} column`}
                  className={`spreadsheet-resize-handle ${
                    resizingColumn === col.columnId ? "spreadsheet-resize-handle--active" : ""
                  }`}
                  onPointerDown={(e) => startColumnResize(col.columnId, e)}
                />
              )}
            </th>
          );
        })}
        <th
          style={{
            width: 48,
            minWidth: 48,
            textAlign: "center",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            background: addingColumn ? "var(--color-bg-hover)" : "var(--color-bg-muted)",
          }}
          onClick={() => setAddingColumn(true)}
          title="Add column"
        >
          {addingColumn ? (
            <input
              ref={newColInputRef}
              type="text"
              className="input input--sm"
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
                  (useVirtualizedBody ? keyboardRef : tableRef).current?.focus();
                }
              }}
              onBlur={handleAddColumnSubmit}
              placeholder="Name"
              style={{ width: 80 }}
            />
          ) : (
            "+"
          )}
        </th>
      </tr>
    </thead>
  );

  const renderTableFoot = () =>
    rows.length > 0 ? (
      <tfoot className="spreadsheet-footer">
        <tr>
          <td
            className="spreadsheet-gutter"
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Sum
          </td>
          {columns.map((col, cIdx) => {
            const sum = columnSums[col.columnId] ?? null;
            const width = resolveColumnWidth(col.columnId);
            return (
              <td
                key={col.columnId}
                style={{
                  minWidth: width,
                  width,
                  textAlign: cIdx === 0 ? "left" : "right",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: sum !== null ? "var(--color-text)" : "var(--color-text-muted)",
                }}
              >
                {sum !== null
                  ? cIdx === 0
                    ? `${rows.length} rows`
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
          <td style={{ minWidth: 48 }} />
        </tr>
      </tfoot>
    ) : null;

  if (columns.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">{EMPTY_STATE_COPY.grid.title}</p>
        <p className="empty-state__hint">{EMPTY_STATE_COPY.grid.hint}</p>
      </div>
    );
  }

  return (
    <div className="spreadsheet">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-sm) var(--space-md)", borderBottom: "1px solid var(--color-border)", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flex: 1, maxWidth: 320 }}>
          <span style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>🔍</span>
          <input
            type="text"
            className="input input--sm"
            placeholder="Search grid cells..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        {searchQuery && (
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
            Found {filteredRows.length} of {rows.length} rows
          </span>
        )}
      </div>
      <div className="spreadsheet-scroll" ref={scrollRef}>
        {useVirtualizedBody ? (
          <div
            ref={keyboardRef}
            className="spreadsheet-keyboard-host"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            <table className="spreadsheet-table" role="grid" aria-label="Spreadsheet editor">
              {renderTableHead()}
            </table>
            <List
              className="spreadsheet-virtual-list"
              style={{ height: listHeight }}
              rowCount={totalRowCount}
              rowHeight={VIRTUAL_ROW_HEIGHT}
              overscanCount={8}
              rowProps={{ renderBodyRow }}
              rowComponent={SpreadsheetVirtualRow}
            />
            <table className="spreadsheet-table">{renderTableFoot()}</table>
          </div>
        ) : (
          <table
            ref={tableRef}
            role="grid"
            aria-label="Spreadsheet editor"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="spreadsheet-table"
          >
            {renderTableHead()}
            <tbody>
              {Array.from({ length: totalRowCount }, (_, rIdx) => renderBodyRow(rIdx))}
            </tbody>
            {renderTableFoot()}
          </table>
        )}
      </div>
    </div>
  );
}