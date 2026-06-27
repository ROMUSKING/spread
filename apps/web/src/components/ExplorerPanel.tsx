import { useState } from "react";

export interface WorkspaceNode {
  id: string;
  label: string;
  kind: "category" | "workbook";
  tags: string[];
}

export interface WorkspaceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

interface ExplorerPanelProps {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  onSelectWorkbook: (workbookId: string) => void;
  activeWorkbookId?: string;
  onAddWorkbook: (label: string, categoryId: string) => void;
  onAddCategory: (label: string) => void;
}

export function ExplorerPanel({
  nodes,
  edges,
  onSelectWorkbook,
  activeWorkbookId,
  onAddWorkbook,
  onAddCategory,
}: ExplorerPanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    all: true,
  });
  const [newWorkbookName, setNewWorkbookName] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showAddWb, setShowAddWb] = useState<string | null>(null);

  const categories = nodes.filter((n) => n.kind === "category");
  const workbooks = nodes.filter((n) => n.kind === "workbook");

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Get workbooks inside a category based on "contains" edges
  const getWorkbooksInFolder = (categoryId: string) => {
    const childIds = edges
      .filter((e) => e.source === categoryId && e.label === "contains")
      .map((e) => e.target);
    return workbooks.filter((wb) => childIds.includes(wb.id));
  };

  // Get inter-workbook relationship links
  const getRelatedWorkbooks = (workbookId: string) => {
    return edges
      .filter((e) => e.source === workbookId && e.label !== "contains")
      .map((e) => {
        const targetNode = workbooks.find((w) => w.id === e.target);
        return {
          edgeId: e.id,
          targetId: e.target,
          label: targetNode ? targetNode.label : e.target,
          relation: e.label,
        };
      });
  };

  const handleCreateWorkbook = (categoryId: string) => {
    const name = newWorkbookName[categoryId]?.trim();
    if (name) {
      onAddWorkbook(name, categoryId);
      setNewWorkbookName((prev) => ({ ...prev, [categoryId]: "" }));
      setShowAddWb(null);
    }
  };

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (name) {
      onAddCategory(name);
      setNewCategoryName("");
      setAddingCategory(false);
    }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
          Module Navigator (Graph Explorer)
        </h3>
        <button
          onClick={() => setAddingCategory(true)}
          style={{
            background: "rgba(59, 130, 246, 0.2)",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            color: "#60a5fa",
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + Category
        </button>
      </div>

      {addingCategory && (
        <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: "6px", marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="Category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              padding: "4px 8px",
              color: "#fff",
              fontSize: "12px",
              marginBottom: "6px",
            }}
          />
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button
              onClick={() => setAddingCategory(false)}
              style={{ background: "transparent", border: "none", color: "#64748b", fontSize: "11px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCategory}
              style={{
                background: "#3b82f6",
                border: "none",
                borderRadius: "4px",
                padding: "2px 8px",
                color: "#fff",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Categories Folder List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {categories.map((cat) => {
          const isExpanded = expandedFolders[cat.id] ?? false;
          const childSheets = getWorkbooksInFolder(cat.id);

          return (
            <div key={cat.id} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => toggleFolder(cat.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                  <span style={{ color: isExpanded ? "#f59e0b" : "#94a3b8" }}>{isExpanded ? "📂" : "📁"}</span>
                  <span>{cat.label}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddWb(showAddWb === cat.id ? null : cat.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "0 4px",
                  }}
                  title="Add sheet"
                >
                  +
                </button>
              </div>

              {showAddWb === cat.id && (
                <div style={{ padding: "6px 8px 6px 28px", display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    placeholder="Sheet name..."
                    value={newWorkbookName[cat.id] || ""}
                    onChange={(e) => setNewWorkbookName({ ...newWorkbookName, [cat.id]: e.target.value })}
                    style={{
                      flex: 1,
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      color: "#fff",
                      fontSize: "11px",
                    }}
                  />
                  <button
                    onClick={() => handleCreateWorkbook(cat.id)}
                    style={{
                      background: "#3b82f6",
                      border: "none",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      color: "#fff",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>
              )}

              {isExpanded && (
                <div style={{ paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                  {childSheets.length === 0 && (
                    <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "11px", padding: "4px 8px" }}>
                      Empty folder
                    </div>
                  )}
                  {childSheets.map((sheet) => {
                    const isActive = activeWorkbookId === sheet.id;
                    const related = getRelatedWorkbooks(sheet.id);

                    return (
                      <div
                        key={sheet.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          background: isActive ? "rgba(59, 130, 246, 0.08)" : "transparent",
                          border: isActive ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
                          borderRadius: "4px",
                          padding: "4px",
                        }}
                      >
                        <div
                          onClick={() => onSelectWorkbook(sheet.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            color: isActive ? "#60a5fa" : "#e2e8f0",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        >
                          <span>📄</span>
                          <span>{sheet.label}</span>
                        </div>

                        {isActive && related.length > 0 && (
                          <div
                            style={{
                              marginLeft: "24px",
                              marginTop: "4px",
                              paddingLeft: "8px",
                              borderLeft: "1px dashed rgba(255,255,255,0.1)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              Linked modules:
                            </div>
                            {related.map((link) => (
                              <div
                                key={link.edgeId}
                                onClick={() => onSelectWorkbook(link.targetId)}
                                style={{
                                  fontSize: "11px",
                                  color: "#a7f3d0",
                                  cursor: "pointer",
                                  padding: "2px 0",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={link.relation}
                              >
                                <span>🔗</span>
                                <span style={{ textDecoration: "underline" }}>{link.label}</span>
                                <span style={{ color: "#64748b", fontSize: "10px" }}>({link.relation})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
