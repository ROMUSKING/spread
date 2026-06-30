import { useState, useRef, useEffect, Fragment } from "react";
import {
  BusinessCommandCenter,
  type BusinessActionStatusMap,
  type FulfillmentAllocateInput,
  type InventoryAdjustInput,
  type PartyCreateInput,
  type ProductCreateInput,
  type PurchaseOrderCreateInput,
  type PurchaseOrderReceiveInput,
  type SalesOrderConfirmInput,
  type SalesOrderCreateInput,
  type InventoryReturnReceiptInput,
  type PaymentRecordInput,
} from "./BusinessCommandCenter";
import { SpreadsheetGrid, type GridRow, type GridColumn, type CommandState } from "./SpreadsheetGrid";
import { ExplorerPanel, type WorkspaceNode, type WorkspaceEdge } from "./ExplorerPanel";
import { WorkbookGraph } from "./WorkbookGraph";
import { TransposedDetail } from "./TransposedDetail";

export interface TileState {
  id: string;
  type: "grid" | "detail" | "explorer" | "graph" | "actions";
  workbookId: string;
  selectedRowId?: string | null;
  gridArea?: string;
}

const TILE_VIEW_LABELS: Record<TileState["type"], string> = {
  actions: "Actions",
  explorer: "Navigator",
  grid: "Grid",
  graph: "Relations",
  detail: "Detail",
};

interface ViewPreset {
  name: string;
  tiles: TileState[];
  layout: "row" | "column";
}

const VIEW_PRESETS: ViewPreset[] = [
  {
    name: "Master Data",
    layout: "row",
    tiles: [
      { id: "tile-preset-md-1", type: "explorer", workbookId: "00000000-0000-0000-0000-000000000021" },
      { id: "tile-preset-md-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000021" },
      { id: "tile-preset-md-3", type: "actions", workbookId: "00000000-0000-0000-0000-000000000021" },
      { id: "tile-preset-md-4", type: "graph", workbookId: "00000000-0000-0000-0000-000000000021" },
    ]
  },
  {
    name: "Sales Processing (OTC)",
    layout: "row",
    tiles: [
      { id: "tile-preset-so-1", type: "grid", workbookId: "00000000-0000-0000-0000-000000000015", gridArea: "1 / 1 / 2 / 2" },
      { id: "tile-preset-so-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000014", gridArea: "2 / 1 / 3 / 2" },
      { id: "tile-preset-so-3", type: "detail", workbookId: "00000000-0000-0000-0000-000000000015", gridArea: "1 / 2 / 2 / 3" },
      { id: "tile-preset-so-4", type: "actions", workbookId: "00000000-0000-0000-0000-000000000015", gridArea: "2 / 2 / 3 / 3" },
    ]
  },
  {
    name: "Warehouse Ops",
    layout: "row",
    tiles: [
      { id: "tile-preset-wh-1", type: "grid", workbookId: "00000000-0000-0000-0000-000000000014" },
      { id: "tile-preset-wh-2", type: "actions", workbookId: "00000000-0000-0000-0000-000000000014" },
      { id: "tile-preset-wh-3", type: "graph", workbookId: "00000000-0000-0000-0000-000000000014" },
    ]
  },
  {
    name: "Procurement (PO)",
    layout: "row",
    tiles: [
      { id: "tile-preset-po-1", type: "grid", workbookId: "00000000-0000-0000-0000-000000000016" },
      { id: "tile-preset-po-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000025" },
      { id: "tile-preset-po-3", type: "detail", workbookId: "00000000-0000-0000-0000-000000000016" },
      { id: "tile-preset-po-4", type: "actions", workbookId: "00000000-0000-0000-0000-000000000016" },
    ]
  },
  {
    name: "Customer Management",
    layout: "row",
    tiles: [
      { id: "tile-preset-cust-1", type: "grid", workbookId: "00000000-0000-0000-0000-000000000011" },
      { id: "tile-preset-cust-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000026" },
      { id: "tile-preset-cust-3", type: "detail", workbookId: "00000000-0000-0000-0000-000000000011" },
      { id: "tile-preset-cust-4", type: "actions", workbookId: "00000000-0000-0000-0000-000000000011" },
      { id: "tile-preset-cust-5", type: "graph", workbookId: "00000000-0000-0000-0000-000000000011" },
    ]
  },
  {
    name: "Returns Management",
    layout: "row",
    tiles: [
      { id: "tile-preset-ret-1", type: "grid", workbookId: "00000000-0000-0000-0000-000000000017" },
      { id: "tile-preset-ret-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000015" },
      { id: "tile-preset-ret-3", type: "grid", workbookId: "00000000-0000-0000-0000-000000000014" },
      { id: "tile-preset-ret-4", type: "detail", workbookId: "00000000-0000-0000-0000-000000000017" },
    ]
  },
  {
    name: "Financials & Invoicing",
    layout: "row",
    tiles: [
      { id: "tile-preset-fin-1", type: "grid", workbookId: "00000000-0000-0000-0000-000000000004" },
      { id: "tile-preset-fin-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000015" },
      { id: "tile-preset-fin-3", type: "detail", workbookId: "00000000-0000-0000-0000-000000000004" },
      { id: "tile-preset-fin-4", type: "graph", workbookId: "00000000-0000-0000-0000-000000000004" },
    ]
  }
];

interface TiledWorkspaceProps {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  allowedWorkbookIds: string[];
  workbookRows: Record<string, GridRow[]>;
  workbookColumns: Record<string, GridColumn[]>;
  commandStates: Map<string, CommandState>;
  onCellEdit: (workbookId: string, rowId: string, columnId: string, value: string) => void;
  onCreateRow: (workbookId: string) => string;
  onDeleteRow: (workbookId: string, rowId: string) => void;
  onAddColumn: (workbookId: string, columnId: string, label: string) => void;
  onAddWorkbook: (label: string, categoryId: string) => void;
  onAddCategory: (label: string) => void;
  onAddEdge: (source: string, target: string, label: string) => void;
  getColumnWidth?: (workbookId: string, columnId: string) => number | undefined;
  onColumnWidthChange?: (workbookId: string, columnId: string, width: number) => void;
  businessActionStatuses: BusinessActionStatusMap;
  onCreateProduct: (input: ProductCreateInput) => Promise<boolean>;
  onAdjustInventory: (input: InventoryAdjustInput) => Promise<boolean>;
  onCreateSalesOrder: (input: SalesOrderCreateInput) => Promise<boolean>;
  onConfirmSalesOrder: (input: SalesOrderConfirmInput) => Promise<boolean>;
  onAllocateFulfillment: (input: FulfillmentAllocateInput) => Promise<boolean>;
  onCreatePurchaseOrder: (input: PurchaseOrderCreateInput) => Promise<boolean>;
  onReceivePurchaseOrder: (input: PurchaseOrderReceiveInput) => Promise<boolean>;
  onCreateParty: (input: PartyCreateInput) => Promise<boolean>;
  onReceiveReturn: (input: InventoryReturnReceiptInput) => Promise<boolean>;
  onRecordPayment: (input: PaymentRecordInput) => Promise<boolean>;
}

export function TiledWorkspace({
  nodes,
  edges,
  allowedWorkbookIds,
  workbookRows,
  workbookColumns,
  commandStates,
  onCellEdit,
  onCreateRow,
  onDeleteRow,
  onAddColumn,
  onAddWorkbook,
  onAddCategory,
  onAddEdge,
  getColumnWidth,
  onColumnWidthChange,
  businessActionStatuses,
  onCreateProduct,
  onAdjustInventory,
  onCreateSalesOrder,
  onConfirmSalesOrder,
  onAllocateFulfillment,
  onCreatePurchaseOrder,
  onReceivePurchaseOrder,
  onCreateParty,
  onReceiveReturn,
  onRecordPayment,
}: TiledWorkspaceProps) {
  const [tiles, setTiles] = useState<TileState[]>([
    { id: "tile-1", type: "explorer", workbookId: "00000000-0000-0000-0000-000000000002" },
    { id: "tile-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000002" },
    { id: "tile-3", type: "graph", workbookId: "00000000-0000-0000-0000-000000000002" },
  ]);

  const [layoutDirection, setLayoutDirection] = useState<"row" | "column">("row");
  const [tileSizes, setTileSizes] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTileSizes(new Array(tiles.length).fill(100 / tiles.length));
  }, [tiles.length]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const currentSizes = tileSizes.length === tiles.length ? tileSizes : new Array(tiles.length).fill(100 / tiles.length);
    const startSizeL = currentSizes[idx];
    const startSizeR = currentSizes[idx + 1];
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const containerSize = layoutDirection === "row" ? rect.width : rect.height;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = layoutDirection === "row" 
        ? moveEvent.clientX - startX 
        : moveEvent.clientY - startY;
      const deltaPercent = (delta / containerSize) * 100;
      
      setTileSizes((prev) => {
        const current = prev.length === tiles.length ? prev : new Array(tiles.length).fill(100 / tiles.length);
        const next = [...current];
        const nextL = Math.max(10, startSizeL + deltaPercent);
        const nextR = Math.max(10, startSizeR - deltaPercent);
        const total = startSizeL + startSizeR;
        const diff = total - (nextL + nextR);
        next[idx] = nextL + diff / 2;
        next[idx + 1] = nextR + diff / 2;
        return next;
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(upEvent.pointerId);
      } catch (err) {
        // ignore
      }
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const applyPreset = (preset: ViewPreset) => {
    const newTiles = preset.tiles.map((t, idx) => ({
      ...t,
      id: `tile-${Date.now()}-${idx}`
    }));
    setTiles(newTiles);
    setLayoutDirection(preset.layout);
  };

  const splitTile = (index: number) => {
    const tileToSplit = tiles[index];
    if (!tileToSplit) return;
    const newTile: TileState = {
      id: `tile-${Date.now()}`,
      type: tileToSplit.type,
      workbookId: tileToSplit.workbookId,
      selectedRowId: null,
    };
    const nextTiles = [...tiles];
    nextTiles.splice(index + 1, 0, newTile);
    setTiles(nextTiles);
  };

  const closeTile = (id: string) => {
    if (tiles.length <= 1) return;
    setTiles(tiles.filter((t) => t.id !== id));
  };

  const updateTile = (id: string, updates: Partial<TileState>) => {
    setTiles(tiles.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleSelectWorkbookGlobal = (targetWbId: string) => {
    if (!allowedWorkbookIds.includes(targetWbId)) return;
    setTiles((prev) =>
      prev.map((t) => {
        if (t.type === "grid" || t.type === "detail" || t.type === "actions") {
          return { ...t, workbookId: targetWbId, selectedRowId: null };
        }
        return t;
      })
    );
  };

  return (
    <div className="workspace">
      <div className="workspace-toolbar" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            {tiles.length} tile{tiles.length === 1 ? "" : "s"}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <label style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", fontWeight: 500 }}>Preset Views:</label>
            <select
              className="select select--sm"
              onChange={(e) => {
                const preset = VIEW_PRESETS.find(p => p.name === e.target.value);
                if (preset) applyPreset(preset);
              }}
              defaultValue=""
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              <option value="" disabled>Select Preset...</option>
              {VIEW_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button
            type="button"
            className={`btn ${layoutDirection === "row" ? "btn--active" : ""}`}
            onClick={() => setLayoutDirection("row")}
          >
            Horizontal
          </button>
          <button
            type="button"
            className={`btn ${layoutDirection === "column" ? "btn--active" : ""}`}
            onClick={() => setLayoutDirection("column")}
          >
            Vertical
          </button>
        </div>
      </div>

      {(() => {
        const hasGridAreas = tiles.some(t => t.gridArea);
        const containerStyle: React.CSSProperties = hasGridAreas
          ? {
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: "var(--space-md)",
              height: "100%",
              width: "100%"
            }
          : {};

        const activeSizes = tileSizes.length === tiles.length ? tileSizes : new Array(tiles.length).fill(100 / tiles.length);

        return (
          <div
            ref={containerRef}
            className={`workspace-tiles workspace-tiles--${layoutDirection}`}
            style={containerStyle}
          >
            {tiles.map((tile, idx) => {
              const rows = workbookRows[tile.workbookId] || [];
              const columns = workbookColumns[tile.workbookId] || [];
              const selectedRow = rows.find((r) => r.rowId === tile.selectedRowId) || null;

              const tileStyle: React.CSSProperties = tile.gridArea
                ? { gridArea: tile.gridArea, display: "flex", flexDirection: "column", height: "100%" }
                : {
                    flex: `${activeSizes[idx]} 1 0%`,
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minWidth: layoutDirection === "row" ? "150px" : "auto",
                    minHeight: layoutDirection === "column" ? "150px" : "auto",
                  };

              return (
                <Fragment key={tile.id}>
                  {idx > 0 && !hasGridAreas && (
                    <div
                      className={`tile-divider tile-divider--${layoutDirection}`}
                      onPointerDown={(e) => handlePointerDown(e, idx - 1)}
                      style={{
                        width: layoutDirection === "row" ? "8px" : "100%",
                        height: layoutDirection === "row" ? "100%" : "8px",
                        cursor: layoutDirection === "row" ? "col-resize" : "row-resize",
                        background: "transparent",
                        alignSelf: "stretch",
                        zIndex: 10,
                        userSelect: "none",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div
                    className="tile"
                    style={tileStyle}
                  >
                    <div className="tile-toolbar">
                      <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                        <select
                          className="select"
                          value={tile.type}
                          onChange={(e) => updateTile(tile.id, { type: e.target.value as TileState["type"] })}
                          aria-label="Tile view"
                        >
                          {(Object.keys(TILE_VIEW_LABELS) as TileState["type"][]).map((type) => (
                            <option key={type} value={type}>
                              {TILE_VIEW_LABELS[type]}
                            </option>
                          ))}
                        </select>

                        {(tile.type === "grid" || tile.type === "detail" || tile.type === "actions") && (
                          <select
                            className="select"
                            value={tile.workbookId}
                            onChange={(e) =>
                              updateTile(tile.id, { workbookId: e.target.value, selectedRowId: null })
                            }
                            aria-label="Workbook"
                          >
                            {nodes
                              .filter((n) => n.kind === "workbook" && allowedWorkbookIds.includes(n.id))
                              .map((wb) => (
                                <option key={wb.id} value={wb.id}>
                                  {wb.label}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => splitTile(idx)}
                          title="Split pane"
                        >
                          Split
                        </button>
                        {tiles.length > 1 && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => closeTile(tile.id)}
                            title="Close pane"
                            style={{ color: "var(--color-danger)" }}
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="tile-content">
                      {tile.type === "explorer" && (
                        <ExplorerPanel
                          nodes={nodes}
                          edges={edges}
                          allowedWorkbookIds={allowedWorkbookIds}
                          activeWorkbookId={tile.workbookId}
                          onSelectWorkbook={handleSelectWorkbookGlobal}
                          onAddWorkbook={(label, catId) => onAddWorkbook(label, catId)}
                          onAddCategory={onAddCategory}
                        />
                      )}

                      {tile.type === "grid" && (
                        <div className="tile-grid-wrap">
                          <SpreadsheetGrid
                            rows={rows}
                            columns={columns}
                            workbookId={tile.workbookId}
                            onCellEdit={(rowId, colId, val) => onCellEdit(tile.workbookId, rowId, colId, val)}
                            onCreateRow={() => onCreateRow(tile.workbookId)}
                            onDeleteRow={(rowId) => onDeleteRow(tile.workbookId, rowId)}
                            onAddColumn={(colId, label) => onAddColumn(tile.workbookId, colId, label)}
                            commandStates={commandStates}
                            {...(getColumnWidth ? { getColumnWidth } : {})}
                            {...(onColumnWidthChange ? { onColumnWidthChange } : {})}
                            onGutterClick={(rIdx) => {
                              const targetRow = rows[rIdx];
                              if (targetRow) {
                                setTiles((prev) =>
                                  prev.map((t) => {
                                    if (t.type === "detail" && t.workbookId === tile.workbookId) {
                                      return { ...t, selectedRowId: targetRow.rowId };
                                    }
                                    return t;
                                  })
                                );
                              }
                            }}
                          />
                        </div>
                      )}

                      {tile.type === "graph" && (
                        <WorkbookGraph
                          nodes={nodes}
                          edges={edges}
                          allowedWorkbookIds={allowedWorkbookIds}
                          activeWorkbookId={tile.workbookId}
                          onSelectWorkbook={handleSelectWorkbookGlobal}
                          onAddEdge={onAddEdge}
                        />
                      )}

                      {tile.type === "detail" && (
                        <TransposedDetail
                          row={selectedRow}
                          columns={columns}
                          workbookId={tile.workbookId}
                          onCellEdit={(rowId, colId, val) => onCellEdit(tile.workbookId, rowId, colId, val)}
                          commandStates={commandStates}
                        />
                      )}

                      {tile.type === "actions" && (
                        <BusinessCommandCenter
                          activeWorkbookId={tile.workbookId}
                          statuses={businessActionStatuses}
                          onCreateProduct={onCreateProduct}
                          onAdjustInventory={onAdjustInventory}
                          onCreateSalesOrder={onCreateSalesOrder}
                          onConfirmSalesOrder={onConfirmSalesOrder}
                          onAllocateFulfillment={onAllocateFulfillment}
                          onCreatePurchaseOrder={onCreatePurchaseOrder}
                          onReceivePurchaseOrder={onReceivePurchaseOrder}
                          onCreateParty={onCreateParty}
                          onReceiveReturn={onReceiveReturn}
                          onRecordPayment={onRecordPayment}
                        />
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}