/**
 * Page — AGENT-060
 *
 * Renders the pilot spreadsheet interface. Wires together the SpreadsheetGrid,
 * useCommand hook for updates, and useSseSubscription hook for live event streams.
 * Includes a premium dark layout, status panel, and ambiguity resolution controls.
 *
 * @see docs/plan/vertical-slice-acceptance-checklist.md
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { SpreadsheetGrid, type GridRow, type GridColumn, type CommandState } from "../components/SpreadsheetGrid";
import { useCommand } from "../lib/useCommand";
import { useSseSubscription } from "../lib/useSseSubscription";

const COLUMNS: GridColumn[] = [
  { columnId: "item_name", label: "Item Name" },
  { columnId: "quantity", label: "Quantity" },
  { columnId: "unit_price", label: "Unit Price ($)" },
  { columnId: "total", label: "Total ($)" },
];

const INITIAL_ROWS: GridRow[] = [
  { rowId: "1", values: { item_name: "Premium Desk", quantity: "2", unit_price: "250.00", total: "500.00" } },
  { rowId: "2", values: { item_name: "Ergonomic Chair", quantity: "5", unit_price: "180.00", total: "900.00" } },
  { rowId: "3", values: { item_name: "Mechanical Keyboard", quantity: "10", unit_price: "85.00", total: "850.00" } },
  { rowId: "4", values: { item_name: "USB-C Hub", quantity: "15", unit_price: "45.00", total: "675.00" } },
  { rowId: "5", values: { item_name: "LED Monitor", quantity: "4", unit_price: "320.00", total: "1280.00" } },
];

type WorkbookRowsResponse = {
  rows: Array<{
    rowId: unknown;
    values: unknown;
  }>;
};

type CommittedCellUpdatePayload = {
  rowId: string;
  columnId: string;
  value: string;
};

function normalizeGridValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null) {
    return "";
  }

  return null;
}

function parseCommittedCellUpdatePayload(payload: unknown): CommittedCellUpdatePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybePayload = payload as Record<string, unknown>;
  const rowId = typeof maybePayload.rowId === "string" ? maybePayload.rowId.trim() : "";
  const columnId = typeof maybePayload.columnId === "string" ? maybePayload.columnId.trim() : "";
  const value = normalizeGridValue(maybePayload.value);

  if (!rowId || !columnId || value === null) {
    return null;
  }

  return { rowId, columnId, value };
}

function parseWorkbookRowsResponse(payload: unknown): GridRow[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const rows = (payload as WorkbookRowsResponse).rows;
  if (!Array.isArray(rows)) {
    return null;
  }

  const normalizedRows: GridRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const rowId = typeof row.rowId === "string" ? row.rowId.trim() : "";
    if (!rowId || !row.values || typeof row.values !== "object" || Array.isArray(row.values)) {
      return null;
    }

    const values: Record<string, string> = {};
    for (const [columnId, value] of Object.entries(row.values as Record<string, unknown>)) {
      const normalizedValue = normalizeGridValue(value);
      if (normalizedValue !== null) {
        values[columnId] = normalizedValue;
      }
    }

    normalizedRows.push({ rowId, values });
  }

  return normalizedRows;
}

export default function Page() {
  const tenantId = "pilot-tenant";
  const workbookId = "pilot-v1-small";

  const [rows, setRows] = useState<GridRow[]>(INITIAL_ROWS);

  // Keep track of the active/pending cell change
  const [activeEdit, setActiveEdit] = useState<{
    rowId: string;
    columnId: string;
    value: string;
  } | null>(null);

  // Command hook for submitting updates
  const cmd = useCommand<{ rowId: string; columnId: string; value: string }>("cell.update", {
    tenantId,
    timeoutMs: 10000,
  });

  const refreshWorkbook = useCallback(
    async (unlockAfterRefresh: boolean) => {
      const response = await fetch(
        `/api/workbooks?tenantId=${encodeURIComponent(tenantId)}&workbookId=${encodeURIComponent(workbookId)}`,
        {
          method: "GET",
          headers: {
            accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Workbook refresh failed (${response.status})`);
      }

      const nextRows = parseWorkbookRowsResponse(await response.json());
      if (!nextRows) {
        throw new Error("Workbook refresh returned an invalid row payload");
      }

      setRows(nextRows);

      if (unlockAfterRefresh) {
        setActiveEdit(null);
        cmd.refresh();
      }
    },
    [cmd.refresh, tenantId, workbookId]
  );

  // Handle server-forced full refresh
  const handleSyncRequired = useCallback(() => {
    console.warn("SYNC_REQUIRED received from outbox. Performing full workbook refresh.");

    void refreshWorkbook(true).catch((error: unknown) => {
      console.error("Workbook refresh failed after SYNC_REQUIRED:", error);
    });
  }, [refreshWorkbook]);

  // SSE Subscription for live stream updates
  const sse = useSseSubscription(tenantId, workbookId, handleSyncRequired);

  useEffect(() => {
    void refreshWorkbook(false).catch((error: unknown) => {
      console.error("Initial workbook refresh failed; keeping seeded rows:", error);
    });
  }, [refreshWorkbook]);

  // Apply inbound SSE events to local grid state
  useEffect(() => {
    if (sse.events.length === 0) return;
    const latestEvent = sse.events[sse.events.length - 1];
    const committedPayload =
      latestEvent && latestEvent.eventType === "cell.update.committed"
        ? parseCommittedCellUpdatePayload(latestEvent.payload)
        : null;

    if (committedPayload) {
      setRows((prev) =>
        prev.map((row) => {
          if (row.rowId !== committedPayload.rowId) {
            return row;
          }

          const updatedValues: Record<string, string> = {
            ...row.values,
            [committedPayload.columnId]: committedPayload.value,
          };

          if (
            committedPayload.columnId === "quantity" ||
            committedPayload.columnId === "unit_price"
          ) {
            const quantity = Number(updatedValues.quantity);
            const unitPrice = Number(updatedValues.unit_price);

            if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
              updatedValues.total = (quantity * unitPrice).toFixed(2);
            }
          }

          return { ...row, values: updatedValues };
        })
      );

      setActiveEdit((current) => {
        if (
          current &&
          current.rowId === committedPayload.rowId &&
          current.columnId === committedPayload.columnId
        ) {
          return null;
        }

        return current;
      });
    }
  }, [sse.events]);

  const handleCellEdit = async (rowId: string, columnId: string, value: string) => {
    // 1. Calculate cell-specific change to check if it's actually different
    const row = rows.find((r) => r.rowId === rowId);
    const oldVal = row ? row.values[columnId] || "" : "";
    if (oldVal === value) return;

    // 2. Set the active optimistic update cell
    setActiveEdit({ rowId, columnId, value });

    // 3. Submit through the command API
    const success = await cmd.submit({ rowId, columnId, value });
    if (!success) {
      // Submission blocked (e.g. rate limit, or ambiguity lock)
      setActiveEdit(null);
    }
  };

  // Derive visual commandStates map for Grid Component
  const commandStates = new Map<string, CommandState>();
  if (activeEdit) {
    const cellId = `${activeEdit.rowId}:${activeEdit.columnId}`;
    let visualState: CommandState["state"] = "pending";

    if (cmd.state === "committed") {
      visualState = "committed";
    } else if (cmd.state === "rejected") {
      visualState = "rejected";
    } else if (cmd.state === "failed") {
      visualState = "rejected";
    } else if (cmd.state === "ambiguous_requires_refresh") {
      visualState = "ambiguous_requires_refresh";
    }

    commandStates.set(cellId, {
      state: visualState,
      value: activeEdit.value,
      error: cmd.error?.message,
    });
  }

  // Copy helper for diagnostics
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isAmbiguous = cmd.state === "ambiguous_requires_refresh";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top left, #1e1e2f, #0d0d15)",
        color: "#f8fafc",
        padding: "40px",
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header section */}
        <header style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, background: "linear-gradient(135deg, #60a5fa, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Spreadsheet-Native ERP
            </h1>
            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
              Phase 0 Vertical Slice Pilot — Tenant: <code>{tenantId}</code>
            </p>
          </div>

          {/* Connection Status panel */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                background:
                  sse.connectionState === "connected"
                    ? "rgba(34, 197, 94, 0.1)"
                    : sse.connectionState === "reconnecting"
                    ? "rgba(249, 115, 22, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                color:
                  sse.connectionState === "connected"
                    ? "#22c55e"
                    : sse.connectionState === "reconnecting"
                    ? "#f97316"
                    : "#ef4444",
                border: "1px solid currentColor",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "currentColor",
                  boxShadow: "0 0 8px currentColor",
                }}
              />
              Live Sync: {sse.connectionState}
            </span>
          </div>
        </header>

        {/* Warning banner on ambiguity lock */}
        {isAmbiguous && (
          <div
            style={{
              background: "rgba(249, 115, 22, 0.1)",
              border: "1px solid #f97316",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h4 style={{ margin: 0, color: "#f97316", fontWeight: 600 }}>Command Outcome Unknown</h4>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#cbd5e1" }}>
                A connection interruption occurred. Retries are locked until workbook state is refreshed.
              </p>
            </div>
            <button
              onClick={() => {
                void refreshWorkbook(true).catch((error: unknown) => {
                  console.error("Workbook refresh failed while unlocking ambiguity:", error);
                });
              }}
              style={{
                background: "#f97316",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
            >
              Refresh &amp; Unlock
            </button>
          </div>
        )}

        {/* Spreadsheet grid */}
        <section style={{ marginBottom: "32px" }}>
          <SpreadsheetGrid
            rows={rows}
            columns={COLUMNS}
            onCellEdit={handleCellEdit}
            commandStates={commandStates}
          />
        </section>

        {/* Footer / Diagnostics panel */}
        <footer style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 12px 0", color: "#94a3b8" }}>Diagnostics Console</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "#64748b" }}>Command Substrate Status:</span>
              <div style={{ fontWeight: 600, color: cmd.state !== "idle" ? "#eab308" : "#94a3b8", marginTop: "4px" }}>
                {cmd.state} {cmd.elapsedMs > 0 && `(${Math.floor(cmd.elapsedMs / 1000)}s elapsed)`}
              </div>
            </div>

            <div>
              <span style={{ color: "#64748b" }}>Last Command ID:</span>
              {cmd.commandId ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>
                    {cmd.commandId}
                  </code>
                  <button
                    onClick={() => copyToClipboard(cmd.commandId!)}
                    style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", padding: 0 }}
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <div style={{ color: "#64748b", marginTop: "4px" }}>None</div>
              )}
            </div>

            <div>
              <span style={{ color: "#64748b" }}>Sync High Watermark:</span>
              <div style={{ fontWeight: 600, marginTop: "4px" }}>
                {sse.lastEventId ? `outbox_id: ${sse.lastEventId}` : "Waiting for updates..."}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
