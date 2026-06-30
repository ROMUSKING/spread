import { isAllowedWorkbook } from './workbooks.ts';

export type AffectsWorkbooksPayload = {
  affects_workbooks?: string[];
};

/** Normalize and allowlist workbook IDs for client refresh fan-out. */
export function normalizeAffectsWorkbooks(
  workbooks: readonly string[],
  primaryWorkbookId?: string | null,
): string[] {
  const ids = new Set<string>();
  if (primaryWorkbookId && isAllowedWorkbook(primaryWorkbookId)) {
    ids.add(primaryWorkbookId);
  }
  for (const id of workbooks) {
    if (typeof id === 'string' && isAllowedWorkbook(id)) {
      ids.add(id);
    }
  }
  return [...ids];
}

/** Read `affects_workbooks` from an outbox/command committed payload. */
export function extractAffectsWorkbooksFromPayload(
  payload: unknown,
  primaryWorkbookId?: string | null,
): string[] {
  const raw =
    payload && typeof payload === 'object'
      ? (payload as AffectsWorkbooksPayload).affects_workbooks
      : undefined;
  const fromPayload = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string')
    : [];
  return normalizeAffectsWorkbooks(fromPayload, primaryWorkbookId);
}

export function withAffectsWorkbooks<T extends Record<string, unknown>>(
  body: T,
  workbooks: readonly string[],
  primaryWorkbookId?: string | null,
): T & { affects_workbooks: string[] } {
  return {
    ...body,
    affects_workbooks: normalizeAffectsWorkbooks(workbooks, primaryWorkbookId),
  };
}