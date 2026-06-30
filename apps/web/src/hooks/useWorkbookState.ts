"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GridRow, GridColumn, CommandState } from "../components/SpreadsheetGrid";
import type { WorkspaceEdge } from "../components/ExplorerPanel";
import type { useCommand } from "../lib/useCommand";
import { ALLOWED_WORKBOOKS } from "../lib/workbookConstants";
import {
  resolveEventWorkbookId,
  assertAllowedWorkbook,
  resolveWorkbooksToRefresh,
  SYNC_REQUIRED_USER_MESSAGE,
} from "../lib/workbookUtils";
import {
  isCommandFailure,
  lifecycleToVisualState,
  resolveEditVisualState,
} from "../lib/commandUtils";
import { DEFAULT_COLUMNS, parseWorkbookResponse } from "../lib/workbookParseUtils";

const REFRESH_MAX_RETRIES = 3;

export type ActiveEdit = {
  workbookId: string;
  rowId: string;
  columnId: string;
  value: string;
  oldValue: string;
  commandId: string | null;
  rowExistedBeforeEdit: boolean;
  lifecycleState: CommandState["state"];
};

type CellCommand = ReturnType<typeof useCommand<{ rowId: string; columnId: string; value: string }>>;
type DeleteCommand = ReturnType<typeof useCommand<{ rowId: string }>>;

export type UseWorkbookStateParams = {
  tenantId: string;
  apiBaseUrl: string;
  edges: WorkspaceEdge[];
  cellCmd: CellCommand;
  deleteCmd: DeleteCommand;
  setCommandNotice: (message: string | null) => void;
};

export function useWorkbookState({
  tenantId,
  apiBaseUrl,
  edges,
  cellCmd,
  deleteCmd,
  setCommandNotice,
}: UseWorkbookStateParams) {
  const [workbookRows, setWorkbookRows] = useState<Record<string, GridRow[]>>({});
  const [workbookColumns, setWorkbookColumns] = useState<Record<string, GridColumn[]>>({});
  const [snapshotLoaded, setSnapshotLoaded] = useState<Record<string, boolean>>({});
  const [sseReady, setSseReady] = useState<Record<string, boolean>>({});
  const [eventBuffers, setEventBuffers] = useState<Record<string, any[]>>({});
  const [workbookSyncErrors, setWorkbookSyncErrors] = useState<Record<string, string>>({});
  const [sseReconnectEpoch, setSseReconnectEpoch] = useState<Record<string, number>>({});
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

  const refreshWorkbookSet = useCallback(
    async (workbookIds: string[]) => {
      const uniqueWorkbookIds = [...new Set(workbookIds)];
      await Promise.all(uniqueWorkbookIds.map((workbookId) => refreshWorkbook(workbookId)));
    },
    [refreshWorkbook]
  );

  useEffect(() => {
    for (const wbId of ALLOWED_WORKBOOKS) {
      void refreshWorkbook(wbId);
    }
  }, [refreshWorkbook]);

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

  const applySseDataEvent = useCallback(
    (event: any) => {
      const eventWorkbookId = resolveEventWorkbookId(event);
      if (!eventWorkbookId) return;

      if (event.eventType === "cell.update.committed") {
        const payload = event.payload;
        if (!payload || typeof payload !== "object") return;
        const rowId = String(payload.rowId);
        const columnId = String(payload.columnId);
        const value =
          typeof payload.value === "string"
            ? payload.value
            : typeof payload.value === "number"
            ? String(payload.value)
            : "";

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

      if (
        typeof event.eventType === "string" &&
        event.eventType.endsWith(".committed") &&
        event.eventType !== "cell.update.committed" &&
        event.eventType !== "row.delete.committed"
      ) {
        const targets = resolveWorkbooksToRefresh(event, edges, ALLOWED_WORKBOOKS);
        if (targets.length > 0) {
          void refreshWorkbookSet(targets);
        } else {
          void refreshWorkbook(eventWorkbookId);
        }
      }
    },
    [edges, refreshWorkbook, refreshWorkbookSet]
  );

  const handleSseEvent = useCallback(
    (event: any) => {
      if (event.eventType === "graph.node.committed" || event.eventType === "graph.edge.committed") {
        return "graph";
      }

      const eventWorkbookId = resolveEventWorkbookId(event);
      if (!eventWorkbookId) return null;

      const ready = !!snapshotLoaded[eventWorkbookId] && !!sseReady[eventWorkbookId];
      if (!ready) {
        setEventBuffers((prev) => {
          const cur = prev[eventWorkbookId] || [];
          if (event.eventId && cur.some((e) => e.eventId === event.eventId)) return prev;
          return { ...prev, [eventWorkbookId]: [...cur, event] };
        });
        return null;
      }
      applySseDataEvent(event);
      return null;
    },
    [snapshotLoaded, sseReady, applySseDataEvent]
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
      setCommandNotice(SYNC_REQUIRED_USER_MESSAGE);
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
    [refreshWorkbook, setCommandNotice]
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
  }, [cellCmd.state, cellCmd.commandId, refreshWorkbook, cellCmd, rollbackCellEdit, setCommandNotice]);

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
    [workbookRows, workbookColumns, cellCmd, refreshWorkbook, rollbackCellEdit, setCommandNotice]
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
    [deleteCmd, workbookRows, refreshWorkbook, setCommandNotice]
  );

  const handleAddColumn = useCallback((workbookId: string, columnId: string, label: string) => {
    setWorkbookColumns((prev) => {
      const cols = prev[workbookId] || [];
      if (cols.some((c) => c.columnId === columnId)) return prev;
      return { ...prev, [workbookId]: [...cols, { columnId, label }] };
    });
  }, []);

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

  return {
    workbookRows,
    workbookColumns,
    snapshotLoaded,
    sseReady,
    sseReconnectEpoch,
    workbookSyncErrors,
    commandStates,
    refreshWorkbook,
    refreshWorkbookSet,
    handleSseEvent,
    handleSyncRequired,
    handleRetrySync,
    handleSseConnected,
    handleCellEdit,
    handleCreateRow,
    handleDeleteRow,
    handleAddColumn,
  };
}