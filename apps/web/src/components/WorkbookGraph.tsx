import { useState, useMemo, useId } from "react";
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

const GRAPH_WIDTH = 450;
const GRAPH_HEIGHT = 350;

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

    categoryNodes.forEach((node, idx) => {
      const spacing = GRAPH_WIDTH / (categoryNodes.length + 1);
      positions[node.id] = { x: spacing * (idx + 1), y: 80 };
    });

    workbookNodes.forEach((node, idx) => {
      const spacing = GRAPH_WIDTH / (workbookNodes.length + 1);
      positions[node.id] = { x: spacing * (idx + 1), y: 240 };
    });

    return positions;
  }, [nodes]);

  const handleNodeClick = (node: WorkspaceNode) => {
    if (linkingSourceId) {
      if (linkingSourceId !== node.id) {
        const label = relationLabel.trim() || "links";
        onAddEdge(linkingSourceId, node.id, label);
      }
      setLinkingSourceId(null);
      setRelationLabel("");
    } else if (node.kind === "workbook" && allowedWorkbookIds.includes(node.id)) {
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
        <div className="graph-canvas">
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
                    stroke={
                      isHighlighted
                        ? "var(--color-accent)"
                        : isContains
                        ? "var(--color-border)"
                        : "var(--color-text-muted)"
                    }
                    strokeWidth={isHighlighted ? 2.5 : isContains ? 1 : 1.5}
                    strokeDasharray={isContains ? "4 4" : undefined}
                    markerEnd={
                      isContains ? undefined : `url(#${isHighlighted ? arrowHighlightId : arrowId})`
                    }
                  />
                  {!isContains && (
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 6}
                      fill={isHighlighted ? "var(--color-accent)" : "var(--color-text-muted)"}
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

            {nodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isCategory = node.kind === "category";
              const isActive = activeWorkbookId === node.id;
              const isHighlighted = isNodeConnected(node.id);
              const isHovered = hoveredNodeId === node.id;
              const radius = isCategory ? 16 : 18;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => handleNodeClick(node)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={radius}
                    fill={
                      isCategory
                        ? "var(--color-category-bg)"
                        : isActive
                        ? "var(--color-accent-muted)"
                        : "var(--color-bg-elevated)"
                    }
                    stroke={
                      isHovered || isHighlighted
                        ? "var(--color-accent)"
                        : isCategory
                        ? "var(--color-category)"
                        : isActive
                        ? "var(--color-accent)"
                        : "var(--color-text-muted)"
                    }
                    strokeWidth={isHovered || isActive ? 2.5 : 1.5}
                  />

                  <text
                    y={isCategory ? 4 : 3}
                    textAnchor="middle"
                    fontSize={isCategory ? "9px" : "8px"}
                    fontWeight={600}
                    fill={isActive ? "var(--color-accent)" : "var(--color-text-secondary)"}
                  >
                    {isCategory ? "CAT" : "WB"}
                  </text>

                  <text
                    y={isCategory ? 30 : 32}
                    fill={isActive ? "var(--color-accent)" : isHovered ? "var(--color-text)" : "var(--color-text-secondary)"}
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
      )}
    </div>
  );
}