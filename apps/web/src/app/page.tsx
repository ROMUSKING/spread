"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CommandNotice, StatusBadge } from "@erp/ui/index";
import { TiledWorkspace } from "../components/TiledWorkspace";
import { AppPreferences } from "../components/AppPreferences";
import { usePreferences } from "../lib/usePreferences";
import type { WorkspaceNode, WorkspaceEdge } from "../components/ExplorerPanel";
import { useCommand } from "../lib/useCommand";
import { useSseSubscription } from "../lib/useSseSubscription";
import { ALLOWED_WORKBOOKS } from "../lib/workbookConstants";
import { isCommandFailure } from "../lib/commandUtils";
import { useWorkbookState } from "../hooks/useWorkbookState";
import { useBusinessCommands } from "../hooks/useBusinessCommands";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

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
  const [graphMutationError, setGraphMutationError] = useState<string | null>(null);
  const [commandNotice, setCommandNotice] = useState<string | null>(null);

  const apiBaseUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : "http://localhost:3001";

  const cellCmd = useCommand("cell.update", { tenantId, baseUrl: apiBaseUrl });
  const deleteCmd = useCommand("row.delete", { tenantId, baseUrl: apiBaseUrl });
  const nodeAddCmd = useCommand("graph.node.add", { tenantId, baseUrl: apiBaseUrl });
  const edgeAddCmd = useCommand("graph.edge.add", { tenantId, baseUrl: apiBaseUrl });

  const workbook = useWorkbookState({
    tenantId,
    apiBaseUrl,
    edges,
    cellCmd,
    deleteCmd,
    setCommandNotice,
  });

  const business = useBusinessCommands({
    tenantId,
    apiBaseUrl,
    edges,
    refreshWorkbookSet: workbook.refreshWorkbookSet,
    setCommandNotice,
  });

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

  useEffect(() => {
    void refreshGraph();
  }, [refreshGraph]);

  const handleSseEvent = useCallback(
    (event: any) => {
      const graphRefresh = workbook.handleSseEvent(event);
      if (graphRefresh === "graph") {
        void refreshGraph();
      }
    },
    [workbook.handleSseEvent, refreshGraph]
  );

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

  return (
    <main className="app-shell">
      {ALLOWED_WORKBOOKS.map((wbId) => (
        <SseSubscriber
          key={`${wbId}-${workbook.sseReconnectEpoch[wbId] || 0}`}
          tenantId={tenantId}
          workbookId={wbId}
          snapshotLoaded={!!workbook.snapshotLoaded[wbId]}
          onEvent={handleSseEvent}
          onSyncRequired={workbook.handleSyncRequired}
          onConnected={workbook.handleSseConnected}
        />
      ))}

      <header className="app-header">
        <div>
          <h1 className="app-title">Spread ERP</h1>
          <p className="app-subtitle">Multi-workbook workspace with live command status</p>
          {commandNotice && <CommandNotice message={commandNotice} />}
          {graphMutationError && (
            <StatusBadge variant="danger" as="p" style={{ marginTop: "var(--space-sm)" }}>
              {graphMutationError}
            </StatusBadge>
          )}
          {Object.entries(workbook.workbookSyncErrors).map(([wbId, msg]) => (
            <div
              key={wbId}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginTop: "var(--space-xs)" }}
            >
              <StatusBadge variant="danger">
                Sync failed for {wbId.slice(-4)}: {msg}
              </StatusBadge>
              <button type="button" className="btn btn--ghost" onClick={() => workbook.handleRetrySync(wbId)}>
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
        workbookRows={workbook.workbookRows}
        workbookColumns={workbook.workbookColumns}
        commandStates={workbook.commandStates}
        onCellEdit={workbook.handleCellEdit}
        onCreateRow={workbook.handleCreateRow}
        onDeleteRow={workbook.handleDeleteRow}
        onAddColumn={workbook.handleAddColumn}
        onAddWorkbook={handleAddWorkbook}
        onAddCategory={handleAddCategory}
        onAddEdge={handleAddEdge}
        getColumnWidth={getColumnWidth}
        onColumnWidthChange={setColumnWidth}
        businessActionStatuses={business.businessActionStatuses}
        onCreateProduct={business.handleCreateProduct}
        onAdjustInventory={business.handleAdjustInventory}
        onCreateSalesOrder={business.handleCreateSalesOrder}
        onConfirmSalesOrder={business.handleConfirmSalesOrder}
        onAllocateFulfillment={business.handleAllocateFulfillment}
        onCreatePurchaseOrder={business.handleCreatePurchaseOrder}
        onReceivePurchaseOrder={business.handleReceivePurchaseOrder}
        onCreateParty={business.handleCreateParty}
        onReceiveReturn={business.handleReceiveReturn}
        onRecordPayment={business.handleRecordPayment}
      />
    </main>
  );
}