"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TiledWorkspace } from "../components/TiledWorkspace";
import { AppPreferences } from "../components/AppPreferences";
import { usePreferences } from "../lib/usePreferences";
import type { GridRow, GridColumn, CommandState } from "../components/SpreadsheetGrid";
import type { WorkspaceNode, WorkspaceEdge } from "../components/ExplorerPanel";
import { useCommand } from "../lib/useCommand";
import { useSseSubscription } from "../lib/useSseSubscription";
import { ALLOWED_WORKBOOKS } from "../lib/workbookConstants";
import { resolveEventWorkbookId, assertAllowedWorkbook } from "../lib/workbookUtils";
import {
  isCommandFailure,
  lifecycleToVisualState,
  resolveEditVisualState,
} from "../lib/commandUtils";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
const REFRESH_MAX_RETRIES = 3;

const DEFAULT_COLUMNS: GridColumn[] = [
  { columnId: "item_name", label: "Item Name" },
  { columnId: "quantity", label: "Quantity" },
  { columnId: "unit_price", label: "Unit Price" },
  { columnId: "total", label: "Total" },
];

type ActiveEdit = {
  workbookId: string;
  rowId: string;
  columnId: string;
  value: string;
  oldValue: string;
  commandId: string | null;
  rowExistedBeforeEdit: boolean;
  lifecycleState: CommandState["state"];
};

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

interface SseSubscriberProps {
  tenantId: string;
  workbookId: string;
  snapshotLoaded: boolean;
  onEvent: (event: any) => void;
  onSyncRequired: (workbookId: string) => void;
  onConnected: (workbookId: string) => void;
}

function SseSubscriber({
  tenantId,
  workbookId,
  snapshotLoaded,
  onEvent,
  onSyncRequired,
  onConnected,
}: SseSubscriberProps) {
  const processedLenRef = useRef(0);
  const handshakeSentRef = useRef(false);

  const handleSync = useCallback(() => {
    handshakeSentRef.current = false;
    onSyncRequired(workbookId);
  }, [workbookId, onSyncRequired]);

  const sse = useSseSubscription(tenantId, workbookId, handleSync);

  useEffect(() => {
    if (sse.events.length > processedLenRef.current) {
      const fresh = sse.events.slice(processedLenRef.current);
      fresh.forEach(onEvent);
      processedLenRef.current = sse.events.length;
    }
  }, [sse.events, onEvent]);

  useEffect(() => {
    if (!snapshotLoaded) {
      handshakeSentRef.current = false;
    }
  }, [snapshotLoaded]);

  useEffect(() => {
    if (sse.connectionState === "connected" && snapshotLoaded && !handshakeSentRef.current) {
      handshakeSentRef.current = true;
      onConnected(workbookId);
    }
    if (sse.connectionState !== "connected") {
      handshakeSentRef.current = false;
    }
  }, [sse.connectionState, snapshotLoaded, workbookId, onConnected]);

  return null;
}

export default function Page() {
  const tenantId = DEFAULT_TENANT;
  const {
    preferences,
    loaded: preferencesLoaded,
    setTheme,
    setDensity,
    setColumnWidth,
    getColumnWidth,
    resetColumnWidths,
  } = usePreferences();

  const [nodes, setNodes] = useState<WorkspaceNode[]>([]);
  const [edges, setEdges] = useState<WorkspaceEdge[]>([]);
  const [workbookRows, setWorkbookRows] = useState<Record<string, GridRow[]>>({});
  const [workbookColumns, setWorkbookColumns] = useState<Record<string, GridColumn[]>>({});
  const [snapshotLoaded, setSnapshotLoaded] = useState<Record<string, boolean>>({});
  const [sseReady, setSseReady] = useState<Record<string, boolean>>({});
  const [eventBuffers, setEventBuffers] = useState<Record<string, any[]>>({});
  const [workbookSyncErrors, setWorkbookSyncErrors] = useState<Record<string, string>>({});
  const [sseReconnectEpoch, setSseReconnectEpoch] = useState<Record<string, number>>({});
  const [graphMutationError, setGraphMutationError] = useState<string | null>(null);
  const [commandNotice, setCommandNotice] = useState<string | null>(null);
  const [activeEdits, setActiveEdits] = useState<Map<string, ActiveEdit>>(new Map());
  const activeEditsRef = useRef(activeEdits);

  const nextRowIdRefs = useRef<Record<string, number>>({});
  const lastCellCommandIdRef = useRef<string | null>(null);
  const lastCellEditRef = useRef<{ workbookId: string; key: string } | null>(null);
  const lastDeleteCommandIdRef = useRef<string | null>(null);
  const lastDeleteContextRef = useRef<{ workbookId: string; prevRows: GridRow[] } | null>(null);
  const ambiguousRecoveryRef = useRef(false);

  useEffect(() => {
    activeEditsRef.current = activeEdits;
  }, [activeEdits]);

  const apiBaseUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : "http://localhost:3001";

  const cellCmd = useCommand("cell.update", { tenantId, baseUrl: apiBaseUrl });
  const deleteCmd = useCommand("row.delete", { tenantId, baseUrl: apiBaseUrl });
  const nodeAddCmd = useCommand("graph.node.add", { tenantId, baseUrl: apiBaseUrl });
  const edgeAddCmd = useCommand("graph.edge.add", { tenantId, baseUrl: apiBaseUrl });

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

  const refreshWorkbook = useCallback(
    async (workbookId: string, attempt = 0): Promise<boolean> => {
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
        setSnapshotLoaded((prev) => ({ ...prev, [workbookId]: true }));
        setWorkbookSyncErrors((prev) => {
          const next = { ...prev };
          delete next[workbookId];
          return next;
        });
        setActiveEdits((prev) => {
          const next = new Map(prev);
          for (const k of Array.from(next.keys())) if (k.startsWith(`${workbookId}:`)) next.delete(k);
          return next;
        });

        const maxId = parsed.rows.reduce((max, r) => {
          const n = Number(r.rowId);
          return !isNaN(n) && n > max ? n : max;
        }, 0);
        nextRowIdRefs.current[workbookId] = maxId + 1;
        return true;
      } catch (e) {
        if (attempt < REFRESH_MAX_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          return refreshWorkbook(workbookId, attempt + 1);
        }
        const message = e instanceof Error ? e.message : "Workbook sync failed";
        console.error(`Failed to refresh workbook ${workbookId}:`, e);
        setWorkbookSyncErrors((prev) => ({ ...prev, [workbookId]: message }));
        return false;
      }
    },
    [tenantId, apiBaseUrl]
  );

  useEffect(() => {
    void refreshGraph();
    for (const wbId of ALLOWED_WORKBOOKS) {
      void refreshWorkbook(wbId);
    }
  }, [refreshGraph, refreshWorkbook]);

  const rollbackCellEdit = useCallback(
    (
      workbookId: string,
      rowId: string,
      columnId: string,
      oldVal: string,
      rowExistedBeforeEdit: boolean
    ) => {
      setWorkbookRows((prev) => {
        const rws = prev[workbookId] || [];
        if (!rowExistedBeforeEdit) {
          return { ...prev, [workbookId]: rws.filter((r) => r.rowId !== rowId) };
        }
        const reverted = rws.map((r) =>
          r.rowId === rowId ? { ...r, values: { ...r.values, [columnId]: oldVal } } : r
        );
        return { ...prev, [workbookId]: reverted };
      });
    },
    []
  );

  const applySseDataEvent = useCallback((event: any) => {
    const eventWorkbookId = resolveEventWorkbookId(event);
    if (!eventWorkbookId) return;

    if (event.eventType === "cell.update.committed") {
      const payload = event.payload;
      if (!payload || typeof payload !== "object") return;
      const rowId = String(payload.rowId);
      const columnId = String(payload.columnId);
      const value = normalizeGridValue(payload.value) || "";

      setWorkbookRows((prev) => {
        const rows = prev[eventWorkbookId] || [];
        const existing = rows.find((r) => r.rowId === rowId);
        let nextRows = [...rows];

        if (existing) {
          nextRows = rows.map((row) => {
            if (row.rowId !== rowId) return row;
            const updatedValues = { ...row.values, [columnId]: value };

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
          nextRows.push({ rowId, values: { [columnId]: value } });
        }
        return { ...prev, [eventWorkbookId]: nextRows };
      });

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
      if (deletedRowId) {
        setWorkbookRows((prev) => {
          const rows = prev[eventWorkbookId] || [];
          return { ...prev, [eventWorkbookId]: rows.filter((r) => r.rowId !== deletedRowId) };
        });
      }
    }
  }, []);

  const handleSseEvent = useCallback(
    (event: any) => {
      if (event.eventType === "graph.node.committed" || event.eventType === "graph.edge.committed") {
        void refreshGraph();
        return;
      }

      const eventWorkbookId = resolveEventWorkbookId(event);
      if (!eventWorkbookId) return;

      const ready = !!snapshotLoaded[eventWorkbookId] && !!sseReady[eventWorkbookId];
      if (!ready) {
        setEventBuffers((prev) => {
          const cur = prev[eventWorkbookId] || [];
          if (event.eventId && cur.some((e) => e.eventId === event.eventId)) return prev;
          return { ...prev, [eventWorkbookId]: [...cur, event] };
        });
        return;
      }
      applySseDataEvent(event);
    },
    [refreshGraph, snapshotLoaded, sseReady, applySseDataEvent]
  );

  useEffect(() => {
    setEventBuffers((prevBuf) => {
      const nextBuf = { ...prevBuf };
      let changed = false;
      Object.keys(snapshotLoaded).forEach((wb) => {
        if (snapshotLoaded[wb] && sseReady[wb]) {
          const buf = nextBuf[wb];
          if (buf && buf.length > 0) {
            buf.forEach((ev) => applySseDataEvent(ev));
            delete nextBuf[wb];
            changed = true;
          }
        }
      });
      return changed ? nextBuf : prevBuf;
    });
  }, [snapshotLoaded, sseReady, applySseDataEvent]);

  const handleSyncRequired = useCallback(
    async (wbId: string) => {
      console.warn(`SYNC_REQUIRED received for ${wbId}`);
      setSnapshotLoaded((prev) => ({ ...prev, [wbId]: false }));
      setSseReady((prev) => ({ ...prev, [wbId]: false }));
      setEventBuffers((prev) => {
        if (!prev[wbId]) return prev;
        const next = { ...prev };
        delete next[wbId];
        return next;
      });
      const ok = await refreshWorkbook(wbId);
      if (!ok) {
        setSseReconnectEpoch((prev) => ({ ...prev, [wbId]: (prev[wbId] || 0) + 1 }));
      }
    },
    [refreshWorkbook]
  );

  const handleRetrySync = useCallback(
    async (wbId: string) => {
      setSnapshotLoaded((prev) => ({ ...prev, [wbId]: false }));
      setSseReady((prev) => ({ ...prev, [wbId]: false }));
      setEventBuffers((prev) => {
        if (!prev[wbId]) return prev;
        const next = { ...prev };
        delete next[wbId];
        return next;
      });
      setSseReconnectEpoch((prev) => ({ ...prev, [wbId]: (prev[wbId] || 0) + 1 }));
      const ok = await refreshWorkbook(wbId);
      if (!ok) {
        setSseReconnectEpoch((prev) => ({ ...prev, [wbId]: (prev[wbId] || 0) + 1 }));
      }
    },
    [refreshWorkbook]
  );

  const handleSseConnected = useCallback((wbId: string) => {
    setSseReady((prev) => ({ ...prev, [wbId]: true }));
  }, []);

  useEffect(() => {
    const cmdId = cellCmd.commandId;
    if (!cmdId) return;
    const mapped = lifecycleToVisualState(cellCmd.state);
    if (!mapped || mapped === "pending") return;

    setActiveEdits((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [key, edit] of next) {
        if (edit.commandId === cmdId && edit.lifecycleState !== mapped) {
          next.set(key, { ...edit, lifecycleState: mapped });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cellCmd.state, cellCmd.commandId]);

  useEffect(() => {
    const failedId = cellCmd.commandId;
    if (cellCmd.state !== "ambiguous_requires_refresh") return;
    if (!failedId || failedId !== lastCellCommandIdRef.current) return;
    if (ambiguousRecoveryRef.current) return;

    const ctx = lastCellEditRef.current;
    if (!ctx) return;

    ambiguousRecoveryRef.current = true;
    void (async () => {
      const ok = await refreshWorkbook(ctx.workbookId);
      if (ok) {
        setActiveEdits((prev) => {
          const next = new Map(prev);
          for (const [k, edit] of next) {
            if (edit.commandId === failedId) next.delete(k);
          }
          return next;
        });
        cellCmd.refresh();
      } else {
        const edit = activeEditsRef.current.get(ctx.key);
        if (edit && edit.commandId === failedId) {
          rollbackCellEdit(
            edit.workbookId,
            edit.rowId,
            edit.columnId,
            edit.oldValue,
            edit.rowExistedBeforeEdit
          );
          setActiveEdits((prev) => {
            const next = new Map(prev);
            const current = next.get(ctx.key);
            if (!current || current.commandId !== failedId) return prev;
            next.set(ctx.key, {
              ...current,
              value: current.oldValue,
              lifecycleState: "ambiguous_requires_refresh",
            });
            return next;
          });
        }
        cellCmd.refresh();
        setCommandNotice("Refresh failed. Edit rolled back; retry after sync recovers.");
      }
      ambiguousRecoveryRef.current = false;
    })();
  }, [cellCmd.state, cellCmd.commandId, refreshWorkbook, cellCmd, rollbackCellEdit]);

  useEffect(() => {
    const failedId = deleteCmd.commandId;
    if (!failedId || failedId !== lastDeleteCommandIdRef.current) return;

    if (isCommandFailure(deleteCmd.state) || deleteCmd.state === "ambiguous_requires_refresh") {
      const ctx = lastDeleteContextRef.current;
      if (ctx) {
        setWorkbookRows((prev) => ({ ...prev, [ctx.workbookId]: ctx.prevRows }));
        void refreshWorkbook(ctx.workbookId);
      }
      if (deleteCmd.state === "ambiguous_requires_refresh") deleteCmd.refresh();
    }
  }, [deleteCmd.state, deleteCmd.commandId, refreshWorkbook, deleteCmd]);

  const handleCellEdit = useCallback(
    async (workbookId: string, rowId: string, columnId: string, value: string) => {
      if (!assertAllowedWorkbook(workbookId)) {
        setCommandNotice(`Workbook ${workbookId.slice(-4)} is not available in this workspace.`);
        return;
      }

      const rows = workbookRows[workbookId] || [];
      const row = rows.find((r) => r.rowId === rowId);
      const oldVal = row ? row.values[columnId] || "" : "";
      const rowExistedBeforeEdit = !!row;
      if (oldVal === value) return;

      const key = `${workbookId}:${rowId}:${columnId}`;
      setCommandNotice(null);
      setActiveEdits((prev) => {
        const next = new Map(prev);
        next.set(key, {
          workbookId,
          rowId,
          columnId,
          value,
          oldValue: oldVal,
          commandId: null,
          rowExistedBeforeEdit,
          lifecycleState: "pending",
        });
        return next;
      });

      setWorkbookRows((prev) => {
        const rws = prev[workbookId] || [];
        let nextRows = rws.map((r) => {
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
        const found = nextRows.some((r) => r.rowId === rowId);
        if (!found) {
          const cols = workbookColumns[workbookId] || DEFAULT_COLUMNS;
          const vals: Record<string, string> = {};
          cols.forEach((c) => {
            vals[c.columnId] = "";
          });
          vals[columnId] = value;
          if (columnId === "quantity" || columnId === "unit_price") {
            const qty = Number(vals.quantity);
            const price = Number(vals.unit_price);
            if (Number.isFinite(qty) && Number.isFinite(price)) {
              vals.total = (qty * price).toFixed(2);
            }
          }
          nextRows = [...nextRows, { rowId, values: vals }];
        }
        return { ...prev, [workbookId]: nextRows };
      });

      const result = await cellCmd.submit({ rowId, columnId, value }, { workbookId });
      lastCellCommandIdRef.current = result.commandId;
      lastCellEditRef.current = { workbookId, key };

      const resolvedLifecycle =
        result.initiated && lifecycleToVisualState(result.state)
          ? lifecycleToVisualState(result.state)!
          : "pending";

      setActiveEdits((prev) => {
        const next = new Map(prev);
        const edit = next.get(key);
        if (edit) {
          next.set(key, { ...edit, commandId: result.commandId, lifecycleState: resolvedLifecycle });
        }
        return next;
      });

      if (!result.initiated) {
        setCommandNotice("Another edit is still in progress. Wait for it to finish.");
        rollbackCellEdit(workbookId, rowId, columnId, oldVal, rowExistedBeforeEdit);
        setActiveEdits((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      if (isCommandFailure(result.state)) {
        rollbackCellEdit(workbookId, rowId, columnId, oldVal, rowExistedBeforeEdit);
        setActiveEdits((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        void refreshWorkbook(workbookId);
      }
    },
    [workbookRows, workbookColumns, cellCmd, refreshWorkbook, rollbackCellEdit]
  );

  const handleCreateRow = useCallback((workbookId: string): string => {
    const currentNextId = nextRowIdRefs.current[workbookId] || 1;
    const newRowId = String(currentNextId);
    nextRowIdRefs.current[workbookId] = currentNextId + 1;
    return newRowId;
  }, []);

  const handleDeleteRow = useCallback(
    async (workbookId: string, rowId: string) => {
      if (!assertAllowedWorkbook(workbookId)) {
        setCommandNotice(`Workbook ${workbookId.slice(-4)} is not available in this workspace.`);
        return;
      }

      const prevRows = workbookRows[workbookId] || [];
      lastDeleteContextRef.current = { workbookId, prevRows };
      setCommandNotice(null);
      setWorkbookRows((prev) => {
        const rws = prev[workbookId] || [];
        return { ...prev, [workbookId]: rws.filter((r) => r.rowId !== rowId) };
      });

      const result = await deleteCmd.submit({ rowId }, { workbookId });
      lastDeleteCommandIdRef.current = result.commandId;

      if (!result.initiated) {
        setCommandNotice("Another command is still in progress. Wait for it to finish.");
        setWorkbookRows((prev) => ({ ...prev, [workbookId]: prevRows }));
        return;
      }

      if (isCommandFailure(result.state)) {
        setWorkbookRows((prev) => ({ ...prev, [workbookId]: prevRows }));
        void refreshWorkbook(workbookId);
      }
    },
    [deleteCmd, workbookRows, refreshWorkbook]
  );

  // Phase 0 UI-only stub: column add is local state until a column command exists.
  const handleAddColumn = useCallback((workbookId: string, columnId: string, label: string) => {
    setWorkbookColumns((prev) => {
      const cols = prev[workbookId] || [];
      if (cols.some((c) => c.columnId === columnId)) return prev;
      return { ...prev, [workbookId]: [...cols, { columnId, label }] };
    });
  }, []);

  const handleAddWorkbook = useCallback(
    async (label: string, categoryId: string) => {
      setGraphMutationError(null);
      const id = "wb-" + Math.random().toString(36).substr(2, 9);
      const nodeResult = await nodeAddCmd.submit({
        id,
        label,
        kind: "workbook",
        tags: [label.toLowerCase()],
      });
      if (!nodeResult.initiated || isCommandFailure(nodeResult.state)) {
        setGraphMutationError(nodeAddCmd.error?.message || "Failed to add workbook");
        return;
      }
      void refreshGraph();
      const edgeId = `${categoryId}:${id}`;
      const edgeResult = await edgeAddCmd.submit({
        id: edgeId,
        source: categoryId,
        target: id,
        label: "contains",
      });
      if (!edgeResult.initiated || isCommandFailure(edgeResult.state)) {
        setGraphMutationError(edgeAddCmd.error?.message || "Failed to link workbook to category");
        void refreshGraph();
        return;
      }
      void refreshGraph();
    },
    [nodeAddCmd, edgeAddCmd, refreshGraph]
  );

  const handleAddCategory = useCallback(
    async (label: string) => {
      setGraphMutationError(null);
      const id = "cat-" + Math.random().toString(36).substr(2, 9);
      const result = await nodeAddCmd.submit({ id, label, kind: "category", tags: [] });
      if (!result.initiated || isCommandFailure(result.state)) {
        setGraphMutationError(nodeAddCmd.error?.message || "Failed to add category");
        return;
      }
      void refreshGraph();
    },
    [nodeAddCmd, refreshGraph]
  );

  const handleAddEdge = useCallback(
    async (source: string, target: string, label: string) => {
      setGraphMutationError(null);
      const id = `${source}:${target}`;
      const result = await edgeAddCmd.submit({ id, source, target, label });
      if (!result.initiated || isCommandFailure(result.state)) {
        setGraphMutationError(edgeAddCmd.error?.message || "Failed to add relation");
        return;
      }
      void refreshGraph();
    },
    [edgeAddCmd, refreshGraph]
  );

  const commandStates = new Map<string, CommandState>();
  for (const [key, edit] of activeEdits) {
    const visualState = resolveEditVisualState(
      edit.lifecycleState,
      edit.commandId,
      cellCmd.commandId,
      cellCmd.commandId && edit.commandId === cellCmd.commandId ? cellCmd.state : null
    );

    commandStates.set(key, {
      state: visualState,
      value: edit.value,
      error: edit.commandId === cellCmd.commandId ? cellCmd.error?.message : undefined,
    });
  }

  return (
    <main className="app-shell">
      {ALLOWED_WORKBOOKS.map((wbId) => (
        <SseSubscriber
          key={`${wbId}-${sseReconnectEpoch[wbId] || 0}`}
          tenantId={tenantId}
          workbookId={wbId}
          snapshotLoaded={!!snapshotLoaded[wbId]}
          onEvent={handleSseEvent}
          onSyncRequired={handleSyncRequired}
          onConnected={handleSseConnected}
        />
      ))}

      <header className="app-header">
        <div>
          <h1 className="app-title">Spread ERP</h1>
          <p className="app-subtitle">Multi-workbook workspace with live command status</p>
          {commandNotice && (
            <p className="status-badge status-badge--danger" style={{ marginTop: "var(--space-sm)" }}>
              {commandNotice}
            </p>
          )}
          {graphMutationError && (
            <p className="status-badge status-badge--danger" style={{ marginTop: "var(--space-sm)" }}>
              {graphMutationError}
            </p>
          )}
          {Object.entries(workbookSyncErrors).map(([wbId, msg]) => (
            <div
              key={wbId}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: "var(--space-xs)" }}
            >
              <span className="status-badge status-badge--danger">
                Sync failed for {wbId.slice(-4)}: {msg}
              </span>
              <button type="button" className="btn btn--ghost" onClick={() => handleRetrySync(wbId)}>
                Retry sync
              </button>
            </div>
          ))}
        </div>
        {preferencesLoaded && (
          <AppPreferences
            theme={preferences.theme}
            density={preferences.density}
            onThemeChange={setTheme}
            onDensityChange={setDensity}
            onResetColumnWidths={resetColumnWidths}
          />
        )}
      </header>

      <TiledWorkspace
        nodes={nodes}
        edges={edges}
        allowedWorkbookIds={[...ALLOWED_WORKBOOKS]}
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
        getColumnWidth={getColumnWidth}
        onColumnWidthChange={setColumnWidth}
      />
    </main>
  );
}