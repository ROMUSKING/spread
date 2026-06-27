import { useState, useEffect } from "react";
import type { GridRow, GridColumn, CommandState } from "./SpreadsheetGrid";

interface TransposedDetailProps {
  row: GridRow | null;
  columns: GridColumn[];
  onCellEdit: (rowId: string, columnId: string, value: string) => void;
  commandStates: Map<string, CommandState>;
}

export function TransposedDetail({
  row,
  columns,
  workbookId,
  onCellEdit,
  commandStates,
}: TransposedDetailProps & { workbookId?: string }) {
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setEditedValues(row.values);
    } else {
      setEditedValues({});
    }
    setEditingField(null);
  }, [row]);

  if (!row) {
    return (
      <div
        style={{
          padding: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#475569",
          fontStyle: "italic",
          fontFamily: "'Inter', sans-serif",
          fontSize: "13px",
          textAlign: "center",
        }}
      >
        Select a row gutter in the spreadsheet to view details
      </div>
    );
  }

  const handleFieldChange = (columnId: string, val: string) => {
    setEditedValues((prev) => ({ ...prev, [columnId]: val }));
  };

  const handleFieldCommit = (columnId: string) => {
    const newVal = editedValues[columnId] || "";
    const oldVal = row.values[columnId] || "";
    if (newVal !== oldVal) {
      onCellEdit(row.rowId, columnId, newVal);
    }
    setEditingField(null);
  };

  return (
    <div
      style={{
        padding: "16px",
        height: "100%",
        overflowY: "auto",
        fontFamily: "'Inter', sans-serif",
        color: "#cbd5e1",
        fontSize: "13px",
      }}
    >
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
          Transposed Record Detail
        </h3>
        <p style={{ margin: "2px 0 0 0", color: "#64748b", fontSize: "11px" }}>
          Row ID: <code>{row.rowId}</code>
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {columns.map((col) => {
          const wb = workbookId || "";
          const cellId = wb ? `${wb}:${row.rowId}:${col.columnId}` : `${row.rowId}:${col.columnId}`;
          const cmdState = commandStates.get(cellId);
          const displayVal = cmdState && cmdState.state !== "rejected" ? cmdState.value : (editedValues[col.columnId] || "");
          const isFieldEditing = editingField === col.columnId;

          // Status colors
          let borderStyle = "1px solid rgba(255,255,255,0.08)";
          let backgroundStyle = "rgba(255,255,255,0.01)";
          let statusText = "";

          if (cmdState) {
            if (cmdState.state === "pending") {
              borderStyle = "1px solid #eab308";
              backgroundStyle = "rgba(234, 179, 8, 0.05)";
              statusText = "Saving...";
            } else if (cmdState.state === "committed") {
              borderStyle = "1px solid #22c55e";
              backgroundStyle = "rgba(34, 197, 94, 0.05)";
            } else if (cmdState.state === "rejected") {
              borderStyle = "1px solid #ef4444";
              backgroundStyle = "rgba(239, 68, 68, 0.05)";
              statusText = cmdState.error || "Rejected";
            } else if (cmdState.state === "ambiguous_requires_refresh") {
              borderStyle = "1px solid #f97316";
              backgroundStyle = "rgba(249, 115, 22, 0.05)";
              statusText = "Ambiguous. Refresh required.";
            }
          }

          return (
            <div
              key={col.columnId}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                background: backgroundStyle,
                border: borderStyle,
                borderRadius: "6px",
                padding: "8px 12px",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {col.label}
                </span>
                {statusText && (
                  <span style={{ color: cmdState?.state === "rejected" ? "#ef4444" : "#eab308" }}>
                    {statusText}
                  </span>
                )}
              </div>

              {isFieldEditing ? (
                <input
                  type="text"
                  value={displayVal}
                  onChange={(e) => handleFieldChange(col.columnId, e.target.value)}
                  onBlur={() => handleFieldCommit(col.columnId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFieldCommit(col.columnId);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditedValues((prev) => ({ ...prev, [col.columnId]: row.values[col.columnId] || "" }));
                      setEditingField(null);
                    }
                  }}
                  autoFocus
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.5)",
                    border: "none",
                    outline: "2px solid #3b82f6",
                    color: "#fff",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    marginTop: "2px",
                  }}
                />
              ) : (
                <div
                  onClick={() => setEditingField(col.columnId)}
                  style={{
                    padding: "4px 0",
                    cursor: "text",
                    minHeight: "24px",
                    display: "flex",
                    alignItems: "center",
                    color: "#e2e8f0",
                  }}
                >
                  {displayVal || <span style={{ color: "#475569", fontStyle: "italic" }}>Empty</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
