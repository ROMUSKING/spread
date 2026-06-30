// Centralized source of truth: packages/contracts/src/workbooks.ts
// Re-export keeps web consumers (page.tsx, workbookUtils.ts) and prior imports stable.
// Use relative .ts form so that web smoke.test.mjs (node --experimental-strip-types loading src/*.ts directly)
// can resolve without relying on @erp package subpath mappings at raw ESM time.
export {
  ALLOWED_WORKBOOKS,
  type AllowedWorkbookId,
  isAllowedWorkbook,
} from "../../../../packages/contracts/src/workbooks.ts";