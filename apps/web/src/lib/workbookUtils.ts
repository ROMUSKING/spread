import { isAllowedWorkbook } from "./workbookConstants.ts";
// KEEP IN SYNC with workbookConstants.ts ALLOWED_WORKBOOKS (see sme-ecommerce-domain-model...spec.md)

export function resolveEventWorkbookId(event: { workbookId?: unknown }): string | null {
  if (typeof event.workbookId !== "string" || !event.workbookId.trim()) return null;
  if (!isAllowedWorkbook(event.workbookId)) return null;
  return event.workbookId;
}

export function assertAllowedWorkbook(workbookId: string): boolean {
  return isAllowedWorkbook(workbookId);
}