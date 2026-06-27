export const ALLOWED_WORKBOOKS = [
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
] as const;

export type AllowedWorkbookId = (typeof ALLOWED_WORKBOOKS)[number];

export function isAllowedWorkbook(workbookId: string): workbookId is AllowedWorkbookId {
  return (ALLOWED_WORKBOOKS as readonly string[]).includes(workbookId);
}