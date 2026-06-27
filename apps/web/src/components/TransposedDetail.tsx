import { useState, useEffect } from "react";
import type { GridRow, GridColumn, CommandState } from "./SpreadsheetGrid";
import { EMPTY_STATE_COPY } from "../lib/emptyStateCopy";

interface TransposedDetailProps {
  row: GridRow | null;
  columns: GridColumn[];
  onCellEdit: (rowId: string, columnId: string, value: string) => void;
  commandStates: Map<string, CommandState>;
  workbookId?: string;
}

function fieldStatusClass(state?: CommandState["state"]): string {
  if (!state) return "";
  if (state === "pending") return "detail-field--pending";
  if (state === "committed") return "detail-field--committed";
  if (state === "rejected") return "detail-field--rejected";
  if (state === "ambiguous_requires_refresh") return "detail-field--ambiguous";
  return "";
}

function statusLabel(state?: CommandState["state"], error?: string): string {
  if (state === "pending") return "Saving";
  if (state === "rejected") return error || "Rejected";
  if (state === "ambiguous_requires_refresh") return "Refresh required";
  return "";
}

export function TransposedDetail({
  row,
  columns,
  workbookId,
  onCellEdit,
  commandStates,
}: TransposedDetailProps) {
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
      <div className="empty-state">
        <p className="empty-state__title">{EMPTY_STATE_COPY.detail.title}</p>
        <p className="empty-state__hint">{EMPTY_STATE_COPY.detail.hint}</p>
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
    <div className="panel-body">
      <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
        <h3 className="panel-title">Record detail</h3>
        <p style={{ margin: "var(--space-xs) 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Row <code style={{ fontFamily: "var(--font-mono)" }}>{row.rowId}</code>
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        {columns.map((col) => {
          const wb = workbookId || "";
          const cellId = wb ? `${wb}:${row.rowId}:${col.columnId}` : `${row.rowId}:${col.columnId}`;
          const cmdState = commandStates.get(cellId);
          const displayVal =
            cmdState && cmdState.state !== "rejected"
              ? cmdState.value
              : editedValues[col.columnId] || "";
          const isFieldEditing = editingField === col.columnId;
          const label = statusLabel(cmdState?.state, cmdState?.error);

          return (
            <div key={col.columnId} className={`detail-field ${fieldStatusClass(cmdState?.state)}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="detail-field-label">{col.label}</span>
                {label && (
                  <span
                    className={`status-badge ${
                      cmdState?.state === "rejected"
                        ? "status-badge--danger"
                        : cmdState?.state === "ambiguous_requires_refresh"
                        ? "status-badge--ambiguous"
                        : "status-badge--pending"
                    }`}
                  >
                    {cmdState?.state === "pending" && <span className="status-dot status-dot--pending" />}
                    {cmdState?.state === "ambiguous_requires_refresh" && (
                      <span className="status-dot status-dot--ambiguous" />
                    )}
                    {label}
                  </span>
                )}
              </div>

              {isFieldEditing ? (
                <input
                  type="text"
                  className="input input--sm"
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
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  className="detail-field-value"
                  onClick={() => setEditingField(col.columnId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingField(col.columnId);
                    }
                  }}
                  style={{
                    padding: "var(--space-xs) 0",
                    cursor: "text",
                    minHeight: 24,
                    color: "var(--color-text)",
                  }}
                >
                  {displayVal || <span style={{ color: "var(--color-text-muted)" }}>Empty</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}