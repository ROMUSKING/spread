/**
 * Page — AGENT-060
 *
 * Renders the tiled spreadsheet-native ERP interface. Wires together the TiledWorkspace,
 * dynamic graph explorer panel, workbook graph visualizations, transposed detail views,
 * useCommand hooks for updates, and dynamic SseSubscriber components for active workbook channels.
 *
 * @see docs/ui/tiled-workspace-graph-specification.md
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TiledWorkspace } from "../components/TiledWorkspace";
import type { GridRow, GridColumn, CommandState } from "../components/SpreadsheetGrid";
import type { WorkspaceNode, WorkspaceEdge } from "../components/ExplorerPanel";
import { useCommand } from "../lib/useCommand";
import { useSseSubscription } from "../lib/useSseSubscription";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
const ALLOWED_WORKBOOKS = [
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
];

const DEFAULT_COLUMNS: GridColumn[] = [
  { columnId: "item_name", label: "Item Name" },
  { columnId: "quantity", label: "Quantity" },
  { columnId: "unit_price", label: "Unit Price" },
  { columnId: "total", label: "Total" },
];

interface WorkbookResponse {
  rows: Array<{ rowId: unknown; values: unknown }>;
  columns?: Array<{ columnId: unknown; label: unknown }>;
}

function normalizeGridValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null) return "";
  return null;
}

function parseWorkbookResponse(
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
        const c = col as Record<string, unknown>;
        if (typeof c.columnId === "string" && typeof c.label === "string") {
          parsedColumns.push({ columnId: c.columnId, label: c.label });
        }
      }
    }
  }

  return { rows: normalizedRows, columns: parsedColumns || DEFAULT_COLUMNS };
}

// Declarative SSE subscriber helper component per workbook ID
interface SseSubscriberProps {
  tenantId: string;
  workbookId: string;
  onEvent: (event: any) => void;
  onSyncRequired: (workbookId: string) => void;
}

function SseSubscriber({ tenantId, workbookId, onEvent, onSyncRequired }: SseSubscriberProps) {
  const handleSync = useCallback(() => {
    onSyncRequired(workbookId);
  }, [workbookId, onSyncRequired]);

  const sse = useSseSubscription(tenantId, workbookId, handleSync);

  useEffect(() => {
    if (sse.events.length > 0) {
      sse.events.forEach(onEvent);
    }
  }, [sse.events, onEvent]);

  return null;
}

export default function Page() {
  const tenantId = DEFAULT_TENANT;

  // Graph state
  const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
  const [edges, setEdges] = useState<WorkspaceEdge[]>([]);

  // Workbooks state
  const [workbookRows, setWorkbookRows] = useState<Record<string, GridRow[]>>({});
  const [workbookColumns, setWorkbookColumns] = useState<Record<string, GridColumn[]>>({});

  // Active in-flight edits map: key is "workbookId:rowId:columnId"
  const [activeEdits, setActiveEdits] = useState<Map<string, { workbookId: string; rowId: string; columnId: string; value: string }>>(new Map());

  // Set of workbook IDs currently visible in tiles
  const [visibleWorkbookIds, setVisibleWorkbookIds] = useState<string[]>(ALLOWED_WORKBOOKS);

  const nextRowIdRefs = useRef<Record<string, number>>({});

  const apiBaseUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : "http://localhost:3001";

  // Commands hooks
  const cellCmd = useCommand("cell.update", { tenantId, baseUrl: apiBaseUrl });
  const deleteCmd = useCommand("row.delete", { tenantId, baseUrl: apiBaseUrl });
  const nodeAddCmd = useCommand("graph.node.add", { tenantId, baseUrl: apiBaseUrl });
  const edgeAddCmd = useCommand("graph.edge.add", { tenantId, baseUrl: apiBaseUrl });

  // Load Graph nodes/edges
  const refreshGraph = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/workspace/graph`);
      if (response.ok) {
        const data = await response.json();
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      }
    } catch (e) {
      console.error("Failed to fetch workspace graph:", e);
    }
  }, [apiBaseUrl]);

  // Load Workbook rows/columns
  const refreshWorkbook = useCallback(
    async (workbookId: string) => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/workbooks?tenantId=${encodeURIComponent(tenantId)}&workbookId=${encodeURIComponent(workbookId)}`,
          { method: "GET", headers: { accept: "application/json" } }
        );

        if (!response.ok) throw new Error(`Fetch failed (${response.status})`);

        const parsed = parseWorkbookResponse(await response.json());
        if (!parsed) throw new Error("Invalid payload format");

        setWorkbookRows((prev) => ({ ...prev, [workbookId]: parsed.rows }));
        setWorkbookColumns((prev) => ({ ...prev, [workbookId]: parsed.columns }));

        // Track max row ID for sequential additions
        const maxId = parsed.rows.reduce((max, r) => {
          const n = Number(r.rowId);
          return !isNaN(n) && n > max ? n : max;
        }, 0);
        nextRowIdRefs.current[workbookId] = maxId + 1;
      } catch (e) {
        console.error(`Failed to refresh workbook ${workbookId}:`, e);
      }
    },
    [tenantId, apiBaseUrl]
  );

  // Initial loads
  useEffect(() => {
    void refreshGraph();
    for (const wbId of ALLOWED_WORKBOOKS) {
      void refreshWorkbook(wbId);
    }
  }, [refreshGraph, refreshWorkbook]);

  // Handle SSE Events
  const handleSseEvent = useCallback(
    (event: any) => {
      if (event.eventType === "cell.update.committed") {
        const payload = event.payload;
        if (!payload || typeof payload !== "object") return;
        const rowId = String(payload.rowId);
        const columnId = String(payload.columnId);
        const value = normalizeGridValue(payload.value) || "";
        const eventWorkbookId = event.workbookId || ALLOWED_WORKBOOKS[0];

        setWorkbookRows((prev) => {
          const rows = prev[eventWorkbookId] || [];
          const existing = rows.find((r) => r.rowId === rowId);
          let nextRows = [...rows];

          if (existing) {
            nextRows = rows.map((row) => {
              if (row.rowId !== rowId) return row;
              const updatedValues = { ...row.values, [columnId]: value };

              // Aggregation total recalculation
              if (columnId === "quantity" || columnId === "unit_price") {
                const qty = Number(updatedValues.quantity);
                const price = Number(updatedValues.unit_price);
                if (Number.isFinite(qty) && Number.isFinite(price)) {
                  updatedValues.total = (qty * price).toFixed(2);
                }
              }
              return { ...row, values: updatedValues };
            });
          } else {
            nextRows.push({
              rowId,
              values: { [columnId]: value },
            });
          }

          return { ...prev, [eventWorkbookId]: nextRows };
        });

        // Clear active edits
        setActiveEdits((prev) => {
          const key = `${eventWorkbookId}:${rowId}:${columnId}`;
          if (prev.has(key)) {
            const next = new Map(prev);
            next.delete(key);
            return next;
          }
          return prev;
        });
      }

      if (event.eventType === "row.delete.committed") {
        const payload = event.payload;
        const deletedRowId = payload && typeof payload.rowId === "string" ? payload.rowId : null;
        const eventWorkbookId = event.workbookId || ALLOWED_WORKBOOKS[0];
        if (deletedRowId) {
          setWorkbookRows((prev) => {
            const rows = prev[eventWorkbookId] || [];
            return {
              ...prev,
              [eventWorkbookId]: rows.filter((r) => r.rowId !== deletedRowId),
            };
          });
        }
      }

      if (event.eventType === "graph.node.committed" || event.eventType === "graph.edge.committed") {
        void refreshGraph();
      }
    },
    [refreshGraph]
  );

  const handleSyncRequired = useCallback(
    (wbId: string) => {
      console.warn(`SYNC_REQUIRED received for ${wbId}`);
      void refreshWorkbook(wbId);
    },
    [refreshWorkbook]
  );

  // ─── Workspace Callbacks ──────────────────────────────────
  const handleCellEdit = useCallback(
    async (workbookId: string, rowId: string, columnId: string, value: string) => {
      const rows = workbookRows[workbookId] || [];
      const row = rows.find((r) => r.rowId === rowId);
      const oldVal = row ? row.values[columnId] || "" : "";
      if (oldVal === value) return;

      const key = `${workbookId}:${rowId}:${columnId}`;
      setActiveEdits((prev) => {
        const next = new Map(prev);
        next.set(key, { workbookId, rowId, columnId, value });
        return next;
      });

      // Optimistic layout update
      setWorkbookRows((prev) => {
        const rws = prev[workbookId] || [];
        const nextRows = rws.map((r) => {
          if (r.rowId !== rowId) return r;
          const updatedValues = { ...r.values, [columnId]: value };
          if (columnId === "quantity" || columnId === "unit_price") {
            const qty = Number(updatedValues.quantity);
            const price = Number(updatedValues.unit_price);
            if (Number.isFinite(qty) && Number.isFinite(price)) {
              updatedValues.total = (qty * price).toFixed(2);
            }
          }
          return { ...r, values: updatedValues };
        });
        return { ...prev, [workbookId]: nextRows };
      });

      const success = await cellCmd.submit({ rowId, columnId, value }, { workbookId });
      if (!success) {
        // Rollback optimistic state
        setActiveEdits((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        void refreshWorkbook(workbookId);
      }
    },
    [workbookRows, cellCmd, refreshWorkbook]
  );

  const handleCreateRow = useCallback(
    (workbookId: string): string => {
      const currentNextId = nextRowIdRefs.current[workbookId] || 1;
      const newRowId = String(currentNextId);
      nextRowIdRefs.current[workbookId] = currentNextId + 1;

      const cols = workbookColumns[workbookId] || DEFAULT_COLUMNS;
      const emptyValues: Record<string, string> = {};
      cols.forEach((c) => {
        emptyValues[c.columnId] = "";
      });

      const newRow: GridRow = { rowId: newRowId, values: emptyValues };
      setWorkbookRows((prev) => ({
        ...prev,
        [workbookId]: [...(prev[workbookId] || []), newRow],
      }));

      return newRowId;
    },
    [workbookColumns]
  );

  const handleDeleteRow = useCallback(
    async (workbookId: string, rowId: string) => {
      setWorkbookRows((prev) => {
        const rws = prev[workbookId] || [];
        return { ...prev, [workbookId]: rws.filter((r) => r.rowId !== rowId) };
      });
      await deleteCmd.submit({ rowId }, { workbookId });
    },
    [deleteCmd]
  );

  const handleAddColumn = useCallback(
    (workbookId: string, columnId: string, label: string) => {
      setWorkbookColumns((prev) => {
        const cols = prev[workbookId] || [];
        if (cols.some((c) => c.columnId === columnId)) return prev;
        return { ...prev, [workbookId]: [...cols, { columnId, label }] };
      });
    },
    []
  );

  const handleAddWorkbook = useCallback(
    async (label: string, categoryId: string) => {
      const id = "wb-" + Math.random().toString(36).substr(2, 9);
      // Submit new workbook node
      await nodeAddCmd.submit({ id, label, kind: "workbook", tags: [label.toLowerCase()] });
      // Submit structural contain edge
      const edgeId = `${categoryId}:${id}`;
      await edgeAddCmd.submit({ id: edgeId, source: categoryId, target: id, label: "contains" });
      void refreshGraph();
    },
    [nodeAddCmd, edgeAddCmd, refreshGraph]
  );

  const handleAddCategory = useCallback(
    async (label: string) => {
      const id = "cat-" + Math.random().toString(36).substr(2, 9);
      await nodeAddCmd.submit({ id, label, kind: "category", tags: [] });
      void refreshGraph();
    },
    [nodeAddCmd, refreshGraph]
  );

  const handleAddEdge = useCallback(
    async (source: string, target: string, label: string) => {
      const id = `${source}:${target}`;
      await edgeAddCmd.submit({ id, source, target, label });
      void refreshGraph();
    },
    [edgeAddCmd, refreshGraph]
  );

  // Derive active commandStates map
  const commandStates = new Map<string, CommandState>();
  for (const [key, edit] of activeEdits) {
    let visualState: CommandState["state"] = "pending";
    if (cellCmd.state === "committed") visualState = "committed";
    else if (cellCmd.state === "rejected" || cellCmd.state === "failed") visualState = "rejected";

    // Split key back to rowId:columnId
    const parts = key.split(":");
    const rowId = parts[1];
    const columnId = parts[2];
    if (rowId && columnId) {
      commandStates.set(`${rowId}:${columnId}`, {
        state: visualState,
        value: edit.value,
        error: cellCmd.error?.message,
      });
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top left, #1e1e2f, #0d0d15)",
        color: "#f8fafc",
        padding: "24px",
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}
    >
      {/* Declarative SSE connections for all workbooks */}
      {visibleWorkbookIds.map((wbId) => (
        <SseSubscriber
          key={wbId}
          tenantId={tenantId}
          workbookId={wbId}
          onEvent={handleSseEvent}
          onSyncRequired={handleSyncRequired}
        />
      ))}

      <div style={{ maxWidth: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Top Header info */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                margin: 0,
                background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Spreadsheet-Native ERP: Tiled Graph Workspace
            </h1>
            <p style={{ margin: "2px 0 0 0", color: "#475569", fontSize: "12px" }}>
              Dynamic Multi-Workbook Splits & Category Graph Relations
            </p>
          </div>
        </header>

        {/* Tiled Workspace */}
        <TiledWorkspace
          nodes={nodes}
          edges={edges}
          workbookRows={workbookRows}
          workbookColumns={workbookColumns}
          commandStates={commandStates}
          onCellEdit={handleCellEdit}
          onCreateRow={handleCreateRow}
          onDeleteRow={handleDeleteRow}
          onAddColumn={handleAddColumn}
          onAddWorkbook={handleAddWorkbook}
          onAddCategory={handleAddCategory}
          onAddEdge={handleAddEdge}
        />
      </div>
    </main>
  );
}
