import {
  extractAffectsWorkbooksFromPayload,
  normalizeAffectsWorkbooks,
} from "../../../../packages/contracts/src/outbox-refresh.ts";
import { isAllowedWorkbook } from "./workbookConstants.ts";

export function resolveEventWorkbookId(event: { workbookId?: unknown }): string | null {
  if (typeof event.workbookId !== "string" || !event.workbookId.trim()) return null;
  if (!isAllowedWorkbook(event.workbookId)) return null;
  return event.workbookId;
}

export function assertAllowedWorkbook(workbookId: string): boolean {
  return isAllowedWorkbook(workbookId);
}

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
};

/** Related workbooks from relations graph edges (excludes folder contains links). */
export function resolveRelatedWorkbooksFromGraph(
  sourceWorkbookId: string,
  edges: GraphEdge[],
  allowedWorkbookIds: readonly string[]
): string[] {
  const allowed = new Set(allowedWorkbookIds);
  return edges
    .filter((edge) => edge.source === sourceWorkbookId && edge.label !== "contains")
    .map((edge) => edge.target)
    .filter((id) => allowed.has(id));
}

/**
 * Workbooks that should refresh after an outbox event.
 * Prefers payload `affects_workbooks`; falls back to primary + graph relations.
 */
export function resolveWorkbooksToRefresh(
  event: { workbookId?: unknown; payload?: unknown },
  edges: GraphEdge[],
  allowedWorkbookIds: readonly string[]
): string[] {
  const primary = resolveEventWorkbookId(event);
  const fromPayload = extractAffectsWorkbooksFromPayload(event.payload, primary);
  if (fromPayload.length > 0) {
    return fromPayload;
  }
  if (!primary) return [];
  const related = resolveRelatedWorkbooksFromGraph(primary, edges, allowedWorkbookIds);
  return normalizeAffectsWorkbooks([primary, ...related], primary);
}

export const SYNC_REQUIRED_USER_MESSAGE =
  "This workbook is out of sync with the server. Your local view will refresh now.";