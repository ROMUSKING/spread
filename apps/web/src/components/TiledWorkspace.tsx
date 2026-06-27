import { useState } from "react";
import { SpreadsheetGrid, type GridRow, type GridColumn, type CommandState } from "./SpreadsheetGrid";
import { ExplorerPanel, type WorkspaceNode, type WorkspaceEdge } from "./ExplorerPanel";
import { WorkbookGraph } from "./WorkbookGraph";
import { TransposedDetail } from "./TransposedDetail";

export interface TileState {
  id: string;
  type: "grid" | "detail" | "explorer" | "graph";
  workbookId: string;
  selectedRowId?: string | null;
}

interface TiledWorkspaceProps {
  // Global states & data
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  workbookRows: Record<string, GridRow[]>;
  workbookColumns: Record<string, GridColumn[]>;
  commandStates: Map<string, CommandState>;

  // Callbacks
  onCellEdit: (workbookId: string, rowId: string, columnId: string, value: string) => void;
  onCreateRow: (workbookId: string) => string;
  onDeleteRow: (workbookId: string, rowId: string) => void;
  onAddColumn: (workbookId: string, columnId: string, label: string) => void;
  onAddWorkbook: (label: string, categoryId: string) => void;
  onAddCategory: (label: string) => void;
  onAddEdge: (source: string, target: string, label: string) => void;
}

export function TiledWorkspace({
  nodes,
  edges,
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
}: TiledWorkspaceProps) {
  const [tiles, setTiles] = useState<TileState[]>([
    { id: "tile-1", type: "explorer", workbookId: "00000000-0000-0000-0000-000000000002" },
    { id: "tile-2", type: "grid", workbookId: "00000000-0000-0000-0000-000000000002" },
    { id: "tile-3", type: "graph", workbookId: "00000000-0000-0000-0000-000000000002" },
  ]);

  const [layoutDirection, setLayoutDirection] = useState<"row" | "column">("row");

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
    if (tiles.length <= 1) return; // Must keep at least one tile
    setTiles(tiles.filter((t) => t.id !== id));
  };

  const updateTile = (id: string, updates: Partial<TileState>) => {
    setTiles(
      tiles.map((t) => {
        if (t.id === id) {
          return { ...t, ...updates };
        }
        return t;
      })
    );
  };

  const handleSelectWorkbookGlobal = (targetWbId: string) => {
    // Switch all spreadsheet grid tiles to the selected workbook ID
    // and reset selected row
    setTiles((prev) =>
      prev.map((t) => {
        if (t.type === "grid" || t.type === "detail") {
          return { ...t, workbookId: targetWbId, selectedRowId: null };
        }
        return t;
      })
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        gap: "12px",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Workspace Controls Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(30,30,45,0.4)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px",
          padding: "8px 16px",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8" }}>
          Workspace Tiles: {tiles.length} active
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setLayoutDirection("row")}
            style={{
              background: layoutDirection === "row" ? "#3b82f6" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              padding: "4px 10px",
              color: "#fff",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Row Layout
          </button>
          <button
            onClick={() => setLayoutDirection("column")}
            style={{
              background: layoutDirection === "column" ? "#3b82f6" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              padding: "4px 10px",
              color: "#fff",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Column Layout
          </button>
        </div>
      </div>

      {/* Tiles Container */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: layoutDirection,
          gap: "12px",
          overflow: "hidden",
        }}
      >
        {tiles.map((tile, idx) => {
          const rows = workbookRows[tile.workbookId] || [];
          const columns = workbookColumns[tile.workbookId] || [];
          const selectedRow = rows.find((r) => r.rowId === tile.selectedRowId) || null;

          return (
            <div
              key={tile.id}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: "rgba(30, 30, 40, 0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                overflow: "hidden",
                minWidth: layoutDirection === "row" ? "300px" : "auto",
                minHeight: layoutDirection === "column" ? "200px" : "auto",
              }}
            >
              {/* Tile Header controls */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(15, 15, 25, 0.8)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  padding: "6px 12px",
                }}
              >
                {/* View Dropdown Selector */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <select
                    value={tile.type}
                    onChange={(e) => updateTile(tile.id, { type: e.target.value as any })}
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      color: "#e2e8f0",
                      fontSize: "11px",
                      padding: "2px 4px",
                      outline: "none",
                    }}
                  >
                    <option value="explorer">🗂️ Module Navigator</option>
                    <option value="grid">📊 Spreadsheet Grid</option>
                    <option value="graph">🔗 Relation Graph</option>
                    <option value="detail">📝 Detail Card</option>
                  </select>

                  {/* Workbook Selector for Spreadsheet/Detail views */}
                  {(tile.type === "grid" || tile.type === "detail") && (
                    <select
                      value={tile.workbookId}
                      onChange={(e) => updateTile(tile.id, { workbookId: e.target.value, selectedRowId: null })}
                      style={{
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "4px",
                        color: "#60a5fa",
                        fontSize: "11px",
                        padding: "2px 4px",
                        outline: "none",
                      }}
                    >
                      {nodes
                        .filter((n) => n.kind === "workbook")
                        .map((wb) => (
                          <option key={wb.id} value={wb.id}>
                            {wb.label}
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Tile Split & Close Actions */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => splitTile(idx)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: "11px",
                      cursor: "pointer",
                      padding: "2px 4px",
                    }}
                    title="Split pane"
                  >
                    🥞 Split
                  </button>
                  {tiles.length > 1 && (
                    <button
                      onClick={() => closeTile(tile.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        fontSize: "11px",
                        cursor: "pointer",
                        padding: "2px 4px",
                      }}
                      title="Close pane"
                    >
                      ❌ Close
                    </button>
                  )}
                </div>
              </div>

              {/* Tile Content Rendering */}
              <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
                {tile.type === "explorer" && (
                  <ExplorerPanel
                    nodes={nodes}
                    edges={edges}
                    activeWorkbookId={tile.workbookId}
                    onSelectWorkbook={handleSelectWorkbookGlobal}
                    onAddWorkbook={(label, catId) => onAddWorkbook(label, catId)}
                    onAddCategory={onAddCategory}
                  />
                )}

                {tile.type === "grid" && (
                  <div style={{ padding: "12px", height: "100%", overflowY: "auto" }}>
                    <SpreadsheetGrid
                      rows={rows}
                      columns={columns}
                      onCellEdit={(rowId, colId, val) => onCellEdit(tile.workbookId, rowId, colId, val)}
                      onCreateRow={() => onCreateRow(tile.workbookId)}
                      onDeleteRow={(rowId) => onDeleteRow(tile.workbookId, rowId)}
                      onAddColumn={(colId, label) => onAddColumn(tile.workbookId, colId, label)}
                      commandStates={commandStates}
                      // Capture row selection for detail cards in the workspace
                      onGutterClick={(rIdx) => {
                        const targetRow = rows[rIdx];
                        if (targetRow) {
                          // Find detail cards in workspace and update their selected row ID
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
                    activeWorkbookId={tile.workbookId}
                    onSelectWorkbook={handleSelectWorkbookGlobal}
                    onAddEdge={onAddEdge}
                  />
                )}

                {tile.type === "detail" && (
                  <TransposedDetail
                    row={selectedRow}
                    columns={columns}
                    onCellEdit={(rowId, colId, val) => onCellEdit(tile.workbookId, rowId, colId, val)}
                    commandStates={commandStates}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
