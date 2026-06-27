import { isAllowedWorkbook } from "./workbookConstants.ts";

export function resolveEventWorkbookId(event: { workbookId?: unknown }): string | null {
  if (typeof event.workbookId !== "string" || !event.workbookId.trim()) return null;
  if (!isAllowedWorkbook(event.workbookId)) return null;
  return event.workbookId;
}

export function assertAllowedWorkbook(workbookId: string): boolean {
  return isAllowedWorkbook(workbookId);
}