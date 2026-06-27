import { useState } from "react";
import { EMPTY_STATE_COPY } from "../lib/emptyStateCopy";

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
  allowedWorkbookIds: string[];
  onSelectWorkbook: (workbookId: string) => void;
  activeWorkbookId?: string;
  onAddWorkbook: (label: string, categoryId: string) => void;
  onAddCategory: (label: string) => void;
}

function activateOnKey(e: React.KeyboardEvent, action: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
}

export function ExplorerPanel({
  nodes,
  edges,
  allowedWorkbookIds,
  onSelectWorkbook,
  activeWorkbookId,
  onAddWorkbook,
  onAddCategory,
}: ExplorerPanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [newWorkbookName, setNewWorkbookName] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showAddWb, setShowAddWb] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = nodes.filter((n) => n.kind === "category");
  const workbooks = nodes.filter((n) => n.kind === "workbook");

  const matchesSearch = (label: string, tags: string[] = []) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return label.toLowerCase().includes(q) || tags.some(t => t.toLowerCase().includes(q));
  };

  const filteredCategories = categories.filter((cat) => {
    if (!searchQuery) return true;
    if (cat.label.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    const childSheets = getWorkbooksInFolder(cat.id);
    return childSheets.some((sheet) => matchesSearch(sheet.label, sheet.tags));
  });

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !(prev[folderId] ?? true) }));
  };

  const getWorkbooksInFolder = (categoryId: string) => {
    const childIds = edges
      .filter((e) => e.source === categoryId && e.label === "contains")
      .map((e) => e.target);
    return workbooks.filter(
      (wb) => childIds.includes(wb.id) && allowedWorkbookIds.includes(wb.id)
    );
  };

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
    <div className="panel-body" role="tree" aria-label="Workbook navigator">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
        <h3 className="panel-title">Navigator</h3>
        <button type="button" className="btn btn--primary" onClick={() => setAddingCategory(true)}>
          Add category
        </button>
      </div>

      <div style={{ marginBottom: "var(--space-md)" }}>
        <input
          type="text"
          className="input input--sm"
          placeholder="Search workbooks, categories, tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      {addingCategory && (
        <div
          style={{
            background: "var(--color-bg-muted)",
            padding: "var(--space-sm)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "var(--space-md)",
          }}
        >
          <input
            type="text"
            className="input input--sm"
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            style={{ marginBottom: "var(--space-sm)" }}
          />
          <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn--ghost" onClick={() => setAddingCategory(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={handleCreateCategory}>
              Create
            </button>
          </div>
        </div>
      )}

      {categories.length === 0 && (
        <div className="empty-state">
          <p className="empty-state__title">{EMPTY_STATE_COPY.explorer.title}</p>
          <p className="empty-state__hint">{EMPTY_STATE_COPY.explorer.hint}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {filteredCategories.map((cat) => {
          const isExpanded = searchQuery ? true : (expandedFolders[cat.id] ?? true);
          const childSheets = getWorkbooksInFolder(cat.id).filter((sheet) =>
            matchesSearch(sheet.label, sheet.tags)
          );

          return (
            <div key={cat.id} role="group">
              <div
                className="tree-folder"
                role="treeitem"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => toggleFolder(cat.id)}
                onKeyDown={(e) => activateOnKey(e, () => toggleFolder(cat.id))}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontWeight: 600 }}>
                  <span className={`tree-chevron ${isExpanded ? "tree-chevron--open" : ""}`} aria-hidden>
                    ▸
                  </span>
                  <span className="folder-icon" aria-hidden />
                  <span>{cat.label}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAddWb(showAddWb === cat.id ? null : cat.id);
                  }}
                  title="Add workbook"
                  style={{ padding: "2px 6px", minWidth: 24 }}
                >
                  +
                </button>
              </div>

              {showAddWb === cat.id && (
                <div
                  style={{
                    padding: "var(--space-sm) var(--space-sm) var(--space-sm) 28px",
                    display: "flex",
                    gap: "var(--space-sm)",
                  }}
                >
                  <input
                    type="text"
                    className="input input--sm"
                    placeholder="Workbook name"
                    value={newWorkbookName[cat.id] || ""}
                    onChange={(e) => setNewWorkbookName({ ...newWorkbookName, [cat.id]: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn--primary" onClick={() => handleCreateWorkbook(cat.id)}>
                    Add
                  </button>
                </div>
              )}

              {isExpanded && (
                <div style={{ paddingLeft: "24px", display: "flex", flexDirection: "column", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
                  {childSheets.length === 0 && (
                    <div style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", padding: "var(--space-xs) var(--space-sm)" }}>
                      {EMPTY_STATE_COPY.explorer.folder}
                    </div>
                  )}
                  {childSheets.map((sheet) => {
                    const isActive = activeWorkbookId === sheet.id;
                    const related = getRelatedWorkbooks(sheet.id);

                    return (
                      <div
                        key={sheet.id}
                        style={{
                          border: isActive ? "1px solid var(--color-accent-muted)" : "1px solid transparent",
                          borderRadius: "var(--radius-sm)",
                          padding: "var(--space-xs)",
                        }}
                      >
                        <div
                          className={`tree-item ${isActive ? "tree-item--active" : ""}`}
                          role="treeitem"
                          tabIndex={0}
                          onClick={() => {
                            if (allowedWorkbookIds.includes(sheet.id)) onSelectWorkbook(sheet.id);
                          }}
                          onKeyDown={(e) =>
                            activateOnKey(e, () => {
                              if (allowedWorkbookIds.includes(sheet.id)) onSelectWorkbook(sheet.id);
                            })
                          }
                        >
                          <span className="sheet-icon" aria-hidden />
                          <span>{sheet.label}</span>
                        </div>

                        {isActive && related.length > 0 && (
                          <div
                            style={{
                              marginLeft: "24px",
                              marginTop: "var(--space-xs)",
                              paddingLeft: "var(--space-sm)",
                              borderLeft: "1px dashed var(--color-border)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "var(--font-size-sm)",
                                color: "var(--color-text-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                marginBottom: "var(--space-xs)",
                              }}
                            >
                              Related
                            </div>
                            {related.map((link) => (
                              <button
                                key={link.edgeId}
                                type="button"
                                className="btn btn--ghost"
                                onClick={() => {
                                  if (allowedWorkbookIds.includes(link.targetId)) {
                                    onSelectWorkbook(link.targetId);
                                  }
                                }}
                                title={link.relation}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  textAlign: "left",
                                  fontSize: "var(--font-size-sm)",
                                  padding: "2px 0",
                                }}
                              >
                                {link.label}
                                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>
                                  ({link.relation})
                                </span>
                              </button>
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