import { useState, useMemo } from "react";
import type { WorkspaceNode, WorkspaceEdge } from "./ExplorerPanel";

interface WorkbookGraphProps {
  nodes: WorkspaceNode[];
  edges: WorkspaceEdge[];
  onSelectWorkbook: (workbookId: string) => void;
  activeWorkbookId?: string;
  onAddEdge: (source: string, target: string, label: string) => void;
}

export function WorkbookGraph({
  nodes,
  edges,
  onSelectWorkbook,
  activeWorkbookId,
  onAddEdge,
}: WorkbookGraphProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [relationLabel, setRelationLabel] = useState("");

  const width = 450;
  const height = 350;

  // Compute node coordinates dynamically on a circle
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const categoryNodes = nodes.filter((n) => n.kind === "category");
    const workbookNodes = nodes.filter((n) => n.kind === "workbook");

    // Position categories in a row at the top
    categoryNodes.forEach((node, idx) => {
      const spacing = width / (categoryNodes.length + 1);
      positions[node.id] = {
        x: spacing * (idx + 1),
        y: 80,
      };
    });

    // Position workbooks in a row at the bottom
    workbookNodes.forEach((node, idx) => {
      const spacing = width / (workbookNodes.length + 1);
      positions[node.id] = {
        x: spacing * (idx + 1),
        y: 240,
      };
    });

    return positions;
  }, [nodes]);

  const handleNodeClick = (node: WorkspaceNode) => {
    if (linkingSourceId) {
      if (linkingSourceId !== node.id) {
        // Create an edge
        const label = relationLabel.trim() || "links";
        onAddEdge(linkingSourceId, node.id, label);
      }
      setLinkingSourceId(null);
      setRelationLabel("");
    } else if (node.kind === "workbook") {
      onSelectWorkbook(node.id);
    }
  };

  const isNodeConnected = (nodeId: string) => {
    if (!hoveredNodeId) return false;
    if (hoveredNodeId === nodeId) return true;
    return edges.some(
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
    <div
      style={{
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
        color: "#cbd5e1",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>
          Workbook Relation Graph
        </h3>
        <button
          onClick={() => {
            if (linkingSourceId) {
              setLinkingSourceId(null);
            } else {
              // Toggle linking mode - select first node
              const firstWb = nodes.find((n) => n.kind === "workbook");
              if (firstWb) setLinkingSourceId(firstWb.id);
            }
          }}
          style={{
            background: linkingSourceId ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
            border: linkingSourceId ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)",
            color: linkingSourceId ? "#f87171" : "#34d399",
            borderRadius: "4px",
            padding: "2px 8px",
            fontSize: "11px",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {linkingSourceId ? "Cancel Link" : "+ Create Link"}
        </button>
      </div>

      {linkingSourceId && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px dashed rgba(16, 185, 129, 0.3)",
            padding: "8px",
            borderRadius: "6px",
            marginBottom: "12px",
            fontSize: "11px",
          }}
        >
          <div>
            1. Source: <strong>{nodes.find((n) => n.id === linkingSourceId)?.label}</strong>
          </div>
          <div style={{ marginTop: "4px", display: "flex", gap: "6px" }}>
            <input
              type="text"
              placeholder="Relation label (e.g. deducts)..."
              value={relationLabel}
              onChange={(e) => setRelationLabel(e.target.value)}
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
            <span style={{ display: "flex", alignItems: "center", color: "#64748b" }}>
              2. Click target node below
            </span>
          </div>
        </div>
      )}

      {/* SVG Canvas */}
      <div
        style={{
          flex: 1,
          background: "rgba(0, 0, 0, 0.2)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "8px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
            </marker>
            <marker
              id="arrow-highlight"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
          </defs>

          {/* Draw Edges / Links */}
          {edges.map((edge) => {
            const from = nodePositions[edge.source];
            const to = nodePositions[edge.target];
            if (!from || !to) return null;

            const isHighlighted = isEdgeHighlighted(edge);
            const isContains = edge.label === "contains";

            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isHighlighted ? "#3b82f6" : isContains ? "rgba(255,255,255,0.08)" : "#475569"}
                  strokeWidth={isHighlighted ? 2.5 : isContains ? 1 : 1.5}
                  strokeDasharray={isContains ? "4 4" : undefined}
                  markerEnd={isContains ? undefined : `url(#${isHighlighted ? "arrow-highlight" : "arrow"})`}
                  style={{ transition: "all 0.2s" }}
                />
                {!isContains && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 6}
                    fill={isHighlighted ? "#93c5fd" : "#64748b"}
                    fontSize="9px"
                    textAnchor="middle"
                    fontWeight={isHighlighted ? 600 : 400}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Draw Nodes */}
          {nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isCategory = node.kind === "category";
            const isActive = activeWorkbookId === node.id;
            const isHighlighted = isNodeConnected(node.id);
            const isHovered = hoveredNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => handleNodeClick(node)}
                style={{ cursor: "pointer" }}
              >
                {/* Node Circle */}
                <circle
                  r={isCategory ? 16 : 18}
                  fill={
                    isCategory
                      ? "rgba(245, 158, 11, 0.15)"
                      : isActive
                      ? "rgba(59, 130, 246, 0.25)"
                      : "rgba(30, 41, 59, 0.8)"
                  }
                  stroke={
                    isHovered || isHighlighted
                      ? "#3b82f6"
                      : isCategory
                      ? "#d97706"
                      : isActive
                      ? "#2563eb"
                      : "#475569"
                  }
                  strokeWidth={isHovered || isActive ? 2.5 : 1.5}
                  style={{ transition: "all 0.15s" }}
                />

                {/* Node Icon */}
                <text y={4} textAnchor="middle" fontSize={isCategory ? "13px" : "15px"}>
                  {isCategory ? "📁" : isActive ? "⭐" : "📄"}
                </text>

                {/* Node Label */}
                <text
                  y={isCategory ? 30 : 32}
                  fill={isActive ? "#60a5fa" : isHovered ? "#fff" : "#94a3b8"}
                  fontSize="10px"
                  fontWeight={isActive || isHovered ? 600 : 400}
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
