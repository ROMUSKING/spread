import { useState, useMemo, useId, useEffect } from "react";
import type { WorkspaceNode, WorkspaceEdge } from "./ExplorerPanel";
import { EMPTY_STATE_COPY } from "../lib/emptyStateCopy";

interface WorkbookGraphProps {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  allowedWorkbookIds: string[];
  onSelectWorkbook: (workbookId: string) => void;
  activeWorkbookId?: string;
  onAddEdge: (source: string, target: string, label: string) => void;
}

const GRAPH_WIDTH = 900;
const GRAPH_HEIGHT = 600;

interface NodeMetadata {
  description: string;
  usage: string;
}

const NODE_METADATA_MAP: Record<string, NodeMetadata> = {
  // Categories
  "00000000-0000-0000-0000-000000000101": {
    description: "Sales Operations folder",
    usage: "Groups master data relating to products, templates, variants, addresses, customer records, and sales documents."
  },
  "00000000-0000-0000-0000-000000000102": {
    description: "Warehouse & Inventory folder",
    usage: "Groups worksheets tracking item stock levels, warehouse locations, and inventory balances."
  },
  "00000000-0000-0000-0000-000000000103": {
    description: "Accounting & Finance folder",
    usage: "Groups worksheets recording purchase order details, accounts payable, and supplier profiles."
  },
  // Workbooks
  "00000000-0000-0000-0000-000000000002": {
    description: "Legacy Pilot Sales Orders directory",
    usage: "Stores customer orders, contact details, item selections, and payment statuses for the legacy pilot system."
  },
  "00000000-0000-0000-0000-000000000010": {
    description: "Pilot Products list",
    usage: "Primary directory for legacy products catalog listing base pricing and SKU item codes."
  },
  "00000000-0000-0000-0000-000000000011": {
    description: "Pilot Customers list",
    usage: "Stores baseline contact records and regional details for legacy e-commerce buyers."
  },
  "00000000-0000-0000-0000-000000000012": {
    description: "Pilot Suppliers list",
    usage: "Procurement channel register mapping active legacy manufacturing/vendor details."
  },
  "00000000-0000-0000-0000-000000000013": {
    description: "Pilot Purchase Orders list",
    usage: "Records purchase order details and procurement costs in the pilot database."
  },
  "00000000-0000-0000-0000-000000000014": {
    description: "Pilot Inventory Stock level tracking",
    usage: "Keeps a running quantity of physical stock items currently residing in the warehouse."
  },
  "00000000-0000-0000-0000-000000000015": {
    description: "Extended Sales Orders workbook",
    usage: "Main registry for customer orders, linking to document headers and extended customer profiles."
  },
  "00000000-0000-0000-0000-000000000016": {
    description: "Extended Purchase Orders workbook",
    usage: "Registry for vendor purchase orders, detailing supplier transactions and material costs."
  },
  "00000000-0000-0000-0000-000000000021": {
    description: "Product Templates specification list",
    usage: "Defines base items parameters (name, description, default pricing, category) prior to option customization."
  },
  "00000000-0000-0000-0000-000000000022": {
    description: "Product Variants registry",
    usage: "Tracks unique stock combinations (color, size) referencing a base product template with custom price/cost deltas."
  },
  "00000000-0000-0000-0000-000000000023": {
    description: "Parties central registry",
    usage: "Master database of legal entities (individuals or corporations) recording tax IDs and primary contact channels."
  },
  "00000000-0000-0000-0000-000000000024": {
    description: "Customers (extended profiles)",
    usage: "Extends active party records with specific business terms like credit limits and payment schedules."
  },
  "00000000-0000-0000-0000-000000000025": {
    description: "Suppliers (extended profiles)",
    usage: "Extends active party records with procurement parameters such as vendor lead times and payment terms."
  },
  "00000000-0000-0000-0000-000000000026": {
    description: "Addresses registry",
    usage: "Stores shipping and billing physical addresses, linking them to party records."
  },
  "00000000-0000-0000-0000-000000000031": {
    description: "Sales Order Headers document ledger",
    usage: "Holds metadata/audit trails for Sales documents (created_at, invoice status, customer_id)."
  },
  "00000000-0000-0000-0000-000000000032": {
    description: "Purchase Order Headers document ledger",
    usage: "Holds metadata/audit trails for Purchase documents (created_at, billing status, supplier_id)."
  }
};

const getCategoryColor = (nodeId: string, nodes: WorkspaceNode[], edges: WorkspaceEdge[]) => {
  let catId = nodeId;
  const node = nodes.find(n => n.id === nodeId);
  if (node?.kind === "workbook") {
    const edge = edges.find(e => e.target === nodeId && e.label === "contains");
    if (edge) {
      catId = edge.source;
    }
  }

  switch (catId) {
    case "00000000-0000-0000-0000-000000000101":
      return { bg: "#ffedd5", border: "#f97316", text: "#ea580c" };
    case "00000000-0000-0000-0000-000000000102":
      return { bg: "#d1fae5", border: "#10b981", text: "#059669" };
    case "00000000-0000-0000-0000-000000000103":
      return { bg: "#e0e7ff", border: "#6366f1", text: "#4f46e5" };
    default:
      return { bg: "var(--color-bg-elevated)", border: "var(--color-text-muted)", text: "var(--color-text-secondary)" };
  }
};

const renderNodeIcon = (node: WorkspaceNode, color: string) => {
  const isCategory = node.kind === "category";

  if (isCategory) {
    return (
      <path
        d="M-8 -6 L-3 -6 L-1 -4 L7 -4 L7 6 L-8 6 Z"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  const label = node.label.toLowerCase();

  if (label.includes("product") || label.includes("variant") || label.includes("template")) {
    return (
      <path
        d="M-6 -4 L0 -7 L6 -4 L6 4 L0 7 L-6 4 Z M-6 -4 L0 -1 L6 -4 M0 -1 L0 7"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    );
  }

  if (label.includes("customer") || label.includes("supplier") || label.includes("party")) {
    return (
      <g>
        <circle cx="0" cy="-3" r="3" fill="none" stroke={color} strokeWidth="1.2" />
        <path d="M-6 5 C-6 2, -3 1, 0 1 C3 1, 6 2, 6 5" fill="none" stroke={color} strokeWidth="1.2" />
      </g>
    );
  }

  if (label.includes("address")) {
    return (
      <g>
        <path d="M0 -7 C-4 -7, -4 -3, 0 1 C4 -3, 4 -7, 0 -7 Z" fill="none" stroke={color} strokeWidth="1.2" />
        <circle cx="0" cy="-4" r="1.5" fill={color} />
      </g>
    );
  }

  if (label.includes("order") && (label.includes("header") || label.includes("document"))) {
    return (
      <g>
        <rect x="-5" y="-6" width="10" height="12" rx="1" fill="none" stroke={color} strokeWidth="1.2" />
        <path d="M-2 -6 L2 -6 M-3 -2 L3 -2 M-3 1 L3 1 M-3 4 L1 4" fill="none" stroke={color} strokeWidth="1.2" />
      </g>
    );
  }

  if (label.includes("order")) {
    return (
      <path
        d="M-7 -5 L-5 -5 L-2 3 L4 3 L7 -2 L-4 -2"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (label.includes("stock") || label.includes("balance") || label.includes("inventory")) {
    return (
      <g>
        <ellipse cx="0" cy="-4" rx="5" ry="2" fill="none" stroke={color} strokeWidth="1.2" />
        <path d="M-5 -4 L-5 1 A5 2 0 0 0 5 1 L5 -4" fill="none" stroke={color} strokeWidth="1.2" />
        <path d="M-5 1 L-5 6 A5 2 0 0 0 5 6 L5 1" fill="none" stroke={color} strokeWidth="1.2" />
      </g>
    );
  }

  return (
    <path
      d="M-5 -6 L2 -6 L5 -3 L5 6 L-5 6 Z M2 -6 L2 -3 L5 -3"
      fill="none"
      stroke={color}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
};

export function WorkbookGraph({
  nodes,
  edges,
  allowedWorkbookIds,
  onSelectWorkbook,
  activeWorkbookId,
  onAddEdge,
}: WorkbookGraphProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [relationLabel, setRelationLabel] = useState("");
  const instanceId = useId().replace(/:/g, "");
  const arrowId = `arrow-${instanceId}`;
  const arrowHighlightId = `arrow-highlight-${instanceId}`;

  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const categoryNodes = nodes.filter((n) => n.kind === "category");
    const workbookNodes = nodes.filter((n) => n.kind === "workbook");

    // Position category nodes horizontally spaced
    categoryNodes.forEach((node, idx) => {
      const spacing = GRAPH_WIDTH / (categoryNodes.length + 1);
      positions[node.id] = { x: spacing * (idx + 1), y: 70 };
    });

    // Group workbooks by their parent category
    const categoryToWorkbooks: Record<string, string[]> = {};
    categoryNodes.forEach((cat) => {
      categoryToWorkbooks[cat.id] = [];
    });
    const orphans: string[] = [];

    workbookNodes.forEach((wb) => {
      const parentEdge = edges.find((e) => e.target === wb.id && e.label === "contains");
      if (parentEdge) {
        const list = categoryToWorkbooks[parentEdge.source];
        if (list) {
          list.push(wb.id);
          return;
        }
      }
      orphans.push(wb.id);
    });

    // Position workbooks under each category in a local 2-column grid to avoid label overlap
    categoryNodes.forEach((cat) => {
      const catPos = positions[cat.id]!;
      const wbs = categoryToWorkbooks[cat.id]!;
      wbs.forEach((wbId, idx) => {
        const cols = 2;
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        const xOffset = (colIdx - (cols - 1) / 2) * 160; // Spacing between columns
        const yOffset = 110 + rowIdx * 90; // Spacing between rows
        positions[wbId] = { x: catPos.x + xOffset, y: catPos.y + yOffset };
      });
    });

    // Position orphans spaced at the bottom
    orphans.forEach((wbId, idx) => {
      const spacing = GRAPH_WIDTH / (orphans.length + 1);
      positions[wbId] = { x: spacing * (idx + 1), y: GRAPH_HEIGHT - 80 };
    });

    return positions;
  }, [nodes, edges]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<WorkspaceNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (activeWorkbookId) {
      setSelectedNodeId(activeWorkbookId);
    }
  }, [activeWorkbookId]);

  const categoryOptions = useMemo(() => {
    return nodes.filter((n) => n.kind === "category");
  }, [nodes]);

  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (selectedCategoryId === "all") {
      return { filteredNodes: nodes, filteredEdges: edges };
    }
    const catNode = nodes.find((n) => n.id === selectedCategoryId);
    if (!catNode) return { filteredNodes: nodes, filteredEdges: edges };

    const containedWbIds = edges
      .filter((e) => e.source === selectedCategoryId && e.label === "contains")
      .map((e) => e.target);

    const linkedNodeIds = new Set<string>();
    edges.forEach((e) => {
      if (e.label !== "contains") {
        if (containedWbIds.includes(e.source)) {
          linkedNodeIds.add(e.target);
        }
        if (containedWbIds.includes(e.target)) {
          linkedNodeIds.add(e.source);
        }
      }
    });

    const activeNodeIds = new Set([
      selectedCategoryId,
      ...containedWbIds,
      ...Array.from(linkedNodeIds),
    ]);

    const filteredNodes = nodes.filter((n) => activeNodeIds.has(n.id));
    const filteredEdges = edges.filter(
      (e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target)
    );

    return { filteredNodes, filteredEdges };
  }, [nodes, edges, selectedCategoryId]);

  const { directConnectedIds, indirectConnectedIds } = useMemo(() => {
    const direct = new Set<string>();
    const indirect = new Set<string>();

    if (!selectedNodeId) {
      return { directConnectedIds: direct, indirectConnectedIds: indirect };
    }

    edges.forEach((e) => {
      if (e.source === selectedNodeId) {
        direct.add(e.target);
      } else if (e.target === selectedNodeId) {
        direct.add(e.source);
      }
    });

    edges.forEach((e) => {
      if (direct.has(e.source) && e.target !== selectedNodeId && !direct.has(e.target)) {
        indirect.add(e.target);
      }
      if (direct.has(e.target) && e.source !== selectedNodeId && !direct.has(e.source)) {
        indirect.add(e.source);
      }
    });

    return { directConnectedIds: direct, indirectConnectedIds: indirect };
  }, [selectedNodeId, edges]);

  const dynamicNodePositions = useMemo(() => {
    if (!selectedNodeId) return nodePositions;

    const centerPos = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
    const dynamicPositions: Record<string, { x: number; y: number }> = {};
    dynamicPositions[selectedNodeId] = centerPos;

    // Direct connections: encircle right next to the centered active node
    const directList = Array.from(directConnectedIds);
    directList.forEach((id, idx) => {
      const angle = (idx / directList.length) * 2 * Math.PI;
      dynamicPositions[id] = {
        x: centerPos.x + Math.cos(angle) * 120,
        y: centerPos.y + Math.sin(angle) * 120,
      };
    });

    // Indirect connections: form a more distant outer circle
    const indirectList = Array.from(indirectConnectedIds);
    indirectList.forEach((id, idx) => {
      const angle = ((idx + 0.5) / indirectList.length) * 2 * Math.PI;
      dynamicPositions[id] = {
        x: centerPos.x + Math.cos(angle) * 220,
        y: centerPos.y + Math.sin(angle) * 220,
      };
    });

    // Completely unconnected nodes: place them on an outer-most ring
    const otherList = nodes
      .map((n) => n.id)
      .filter(
        (id) =>
          id !== selectedNodeId &&
          !directConnectedIds.has(id) &&
          !indirectConnectedIds.has(id)
      );
    otherList.forEach((id, idx) => {
      const angle = (idx / otherList.length) * 2 * Math.PI;
      dynamicPositions[id] = {
        x: centerPos.x + Math.cos(angle) * 320,
        y: centerPos.y + Math.sin(angle) * 320,
      };
    });

    return dynamicPositions;
  }, [nodePositions, selectedNodeId, directConnectedIds, indirectConnectedIds, nodes]);

  const handleNodeClick = (node: WorkspaceNode) => {
    if (linkingSourceId) {
      if (linkingSourceId !== node.id) {
        const label = relationLabel.trim() || "links";
        onAddEdge(linkingSourceId, node.id, label);
      }
      setLinkingSourceId(null);
      setRelationLabel("");
    } else {
      setSelectedNodeId(node.id);
      if (node.kind === "workbook" && allowedWorkbookIds.includes(node.id)) {
        onSelectWorkbook(node.id);
      } else if (node.kind === "category") {
        const containedWb = edges.find(
          (e) => e.source === node.id && e.label === "contains" && allowedWorkbookIds.includes(e.target)
        );
        if (containedWb) {
          onSelectWorkbook(containedWb.target);
        }
      }
    }
  };

  const isNodeConnected = (nodeId: string) => {
    if (!hoveredNodeId) return false;
    if (hoveredNodeId === nodeId) return true;
    return filteredEdges.some(
      (e) =>
        (e.source === hoveredNodeId && e.target === nodeId) ||
        (e.target === hoveredNodeId && e.source === nodeId)
    );
  };

  const isEdgeHighlighted = (edge: WorkspaceEdge) => {
    if (!hoveredNodeId) return false;
    return edge.source === hoveredNodeId || edge.target === hoveredNodeId;
  };

  return (
    <div className="panel-body" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
        <h3 className="panel-title">Relations</h3>
        <button
          type="button"
          className={linkingSourceId ? "btn btn--danger" : "btn"}
          onClick={() => {
            if (linkingSourceId) {
              setLinkingSourceId(null);
            } else {
              const firstWb = nodes.find((n) => n.kind === "workbook");
              if (firstWb) setLinkingSourceId(firstWb.id);
            }
          }}
        >
          {linkingSourceId ? "Cancel link" : "Create link"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", alignItems: "center", marginBottom: "var(--space-sm)", paddingBottom: "var(--space-xs)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <label style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Group:</label>
          <select
            className="select select--sm"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="all">All Modules</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} title="Zoom in" style={{ padding: "4px 8px" }}>＋</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} title="Zoom out" style={{ padding: "4px 8px" }}>－</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }} title="Reset view" style={{ padding: "4px 8px" }}>⟲</button>
        </div>

        <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPan(p => ({ ...p, y: p.y - 40 }))} title="Pan up" style={{ padding: "4px 8px" }}>▲</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPan(p => ({ ...p, y: p.y + 40 }))} title="Pan down" style={{ padding: "4px 8px" }}>▼</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPan(p => ({ ...p, x: p.x - 40 }))} title="Pan left" style={{ padding: "4px 8px" }}>◀</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPan(p => ({ ...p, x: p.x + 40 }))} title="Pan right" style={{ padding: "4px 8px" }}>▶</button>
        </div>
      </div>

      {linkingSourceId && (
        <div className="graph-hint">
          <div>
            Source: <strong>{nodes.find((n) => n.id === linkingSourceId)?.label}</strong>
          </div>
          <div style={{ marginTop: "var(--space-xs)", display: "flex", gap: "var(--space-sm)" }}>
            <input
              type="text"
              className="input input--sm"
              placeholder="Relation label"
              value={relationLabel}
              onChange={(e) => setRelationLabel(e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ display: "flex", alignItems: "center", color: "var(--color-text-muted)" }}>
              Click target node
            </span>
          </div>
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">{EMPTY_STATE_COPY.graph.title}</p>
          <p className="empty-state__hint">{EMPTY_STATE_COPY.graph.hint}</p>
        </div>
      ) : (
        <div className="graph-canvas" style={{ position: "relative" }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-text-muted)" />
              </marker>
              <marker
                id={arrowHighlightId}
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {filteredEdges.map((edge) => {
                const from = dynamicNodePositions[edge.source];
                const to = dynamicNodePositions[edge.target];
                if (!from || !to) return null;

                const isContains = edge.label === "contains";
                const isDirectLink = selectedNodeId && !isContains && (edge.source === selectedNodeId || edge.target === selectedNodeId);
                const isIndirectLink = selectedNodeId && !isContains && !isDirectLink && (directConnectedIds.has(edge.source) || directConnectedIds.has(edge.target));
                const isHighlighted = isEdgeHighlighted(edge);

                return (
                  <g key={edge.id}>
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={
                        isContains
                          ? "var(--color-border)"
                          : isDirectLink
                          ? "var(--color-accent)"
                          : isIndirectLink
                          ? "#a855f7"
                          : isHighlighted
                          ? "var(--color-accent)"
                          : "var(--color-text-muted)"
                      }
                      strokeWidth={isContains ? 1 : isDirectLink ? 3.0 : isIndirectLink ? 2.0 : isHighlighted ? 2.5 : 1.5}
                      strokeDasharray={isContains ? "4 4" : undefined}
                      markerEnd={
                        isContains ? undefined : `url(#${isHighlighted || isDirectLink ? arrowHighlightId : arrowId})`
                      }
                    />
                    {!isContains && (
                      <text
                        x={(from.x + to.x) / 2}
                        y={(from.y + to.y) / 2 - 6}
                        fill={isHighlighted ? "var(--color-accent)" : "var(--color-text-muted)"}
                        fontSize="10px"
                        textAnchor="middle"
                        fontWeight={isHighlighted ? 600 : 400}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {filteredNodes.map((node) => {
                const pos = dynamicNodePositions[node.id];
                if (!pos) return null;

                const isCategory = node.kind === "category";
                const isActive = activeWorkbookId === node.id;
                const isActiveNode = selectedNodeId === node.id;
                const isHighlighted = isNodeConnected(node.id);
                const isHovered = hoveredNodeId === node.id;
                const radius = isActiveNode ? 24 : (isCategory ? 18 : 20);
                const colors = getCategoryColor(node.id, nodes, edges);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseEnter={() => {
                      setHoveredNodeId(node.id);
                      setHoveredNode(node);
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                      if (rect) {
                        setTooltipPos({
                          x: e.clientX - rect.left + 15,
                          y: e.clientY - rect.top + 15,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredNodeId(null);
                      setHoveredNode(null);
                    }}
                    onClick={() => handleNodeClick(node)}
                    style={{ cursor: "pointer" }}
                  >
                        <circle
                          r={radius}
                          fill={
                            isActiveNode
                              ? colors.border
                              : colors.bg
                          }
                          stroke={
                            isActiveNode
                              ? "var(--color-bg)"
                              : isHovered || isHighlighted
                              ? "var(--color-accent)"
                              : colors.border
                          }
                          strokeWidth={isActiveNode ? 3.5 : isHovered || isActive ? 2.5 : 1.5}
                        />

                        {renderNodeIcon(node, isActiveNode ? "#ffffff" : colors.text)}

                        <text
                          y={isActiveNode ? 42 : isCategory ? 34 : 36}
                          fill={
                            isActiveNode
                              ? colors.border
                              : isActive
                              ? colors.border
                              : isHovered
                              ? "var(--color-text)"
                              : "var(--color-text-secondary)"
                          }
                          fontSize={isActiveNode ? "12px" : "11px"}
                          fontWeight={isActiveNode || isActive || isHovered ? 600 : 400}
                          textAnchor="middle"
                        >
                          {node.label}
                        </text>
                  </g>
                );
              })}
            </g>
          </svg>
          {hoveredNode && (
            <div
              style={{
                position: "absolute",
                left: tooltipPos.x,
                top: tooltipPos.y,
                pointerEvents: "none",
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                color: "#ffffff",
                padding: "var(--space-sm) var(--space-md)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                fontSize: "var(--font-size-sm)",
                maxWidth: "280px",
                zIndex: 100,
              }}
            >
              <div style={{ fontWeight: 600, borderBottom: "1px solid rgba(255, 255, 255, 0.15)", paddingBottom: "var(--space-xs)", marginBottom: "var(--space-xs)", color: "var(--color-accent)" }}>
                {hoveredNode.label}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", opacity: 0.9, lineHeight: 1.4, marginBottom: "var(--space-xs)" }}>
                {NODE_METADATA_MAP[hoveredNode.id]?.description || `${hoveredNode.kind === "category" ? "Category folder" : "Workbook node"}`}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", opacity: 0.75, lineHeight: 1.4, fontStyle: "italic" }}>
                {NODE_METADATA_MAP[hoveredNode.id]?.usage || "No usage instructions defined."}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}