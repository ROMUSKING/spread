import {
  COLUMN_WIDTH_DEFAULT,
  COLUMN_WIDTH_MAX,
  COLUMN_WIDTH_MIN,
} from "./uiConstants.ts";

export type Theme = "dark" | "light";
export type Density = "comfortable" | "compact";

export type UiPreferences = {
  theme: Theme;
  density: Density;
  columnWidths: Record<string, number>;
};

export const PREFERENCES_STORAGE_KEY = "spread-erp-ui-preferences";

export const DEFAULT_PREFERENCES: UiPreferences = {
  theme: "dark",
  density: "comfortable",
  columnWidths: {},
};

export function columnWidthKey(workbookId: string, columnId: string): string {
  return `${workbookId}:${columnId}`;
}

export function clampColumnWidth(width: number): number {
  if (!Number.isFinite(width)) return COLUMN_WIDTH_DEFAULT;
  return Math.max(COLUMN_WIDTH_MIN, Math.min(COLUMN_WIDTH_MAX, Math.round(width)));
}

export function normalizeColumnWidths(
  raw: Record<string, unknown> | undefined
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = clampColumnWidth(value);
    }
  }
  return normalized;
}

export function readStoredPreferences(
  storageKey: string = PREFERENCES_STORAGE_KEY,
  storage: Pick<Storage, "getItem"> | null = typeof window !== "undefined" ? window.localStorage : null
): UiPreferences {
  if (!storage) return DEFAULT_PREFERENCES;
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return {
      theme: parsed.theme === "light" ? "light" : "dark",
      density: parsed.density === "compact" ? "compact" : "comfortable",
      columnWidths: normalizeColumnWidths(
        parsed.columnWidths as Record<string, unknown> | undefined
      ),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function applyDocumentAttributes(prefs: UiPreferences, doc: Document = document): void {
  doc.documentElement.setAttribute("data-theme", prefs.theme);
  doc.documentElement.setAttribute("data-density", prefs.density);
}

export function buildPreferencesBootstrapScript(storageKey: string = PREFERENCES_STORAGE_KEY): string {
  return `(function(){try{var r=localStorage.getItem(${JSON.stringify(storageKey)});if(!r)return;var p=JSON.parse(r);var t=p.theme==="light"?"light":"dark";var d=p.density==="compact"?"compact":"comfortable";document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-density",d);}catch(e){}})();`;
}