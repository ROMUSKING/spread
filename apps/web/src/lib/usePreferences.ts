"use client";

import { useState, useEffect, useCallback } from "react";
import {
  applyDocumentAttributes,
  clampColumnWidth,
  columnWidthKey,
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  readStoredPreferences,
  type Density,
  type Theme,
  type UiPreferences,
} from "./preferencesUtils";

export type { Density, Theme, UiPreferences } from "./preferencesUtils";
export { columnWidthKey } from "./preferencesUtils";

function savePreferences(prefs: UiPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readStoredPreferences();
    setPreferences(stored);
    applyDocumentAttributes(stored);
    setLoaded(true);
  }, []);

  const updatePreferences = useCallback((patch: Partial<UiPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      applyDocumentAttributes(next);
      savePreferences(next);
      return next;
    });
  }, []);

  const setTheme = useCallback(
    (theme: Theme) => updatePreferences({ theme }),
    [updatePreferences]
  );

  const setDensity = useCallback(
    (density: Density) => updatePreferences({ density }),
    [updatePreferences]
  );

  const setColumnWidth = useCallback((workbookId: string, columnId: string, width: number) => {
    const key = columnWidthKey(workbookId, columnId);
    const clamped = clampColumnWidth(width);
    setPreferences((prev) => {
      const next = {
        ...prev,
        columnWidths: { ...prev.columnWidths, [key]: clamped },
      };
      savePreferences(next);
      return next;
    });
  }, []);

  const getColumnWidth = useCallback(
    (workbookId: string, columnId: string): number | undefined => {
      const key = columnWidthKey(workbookId, columnId);
      return preferences.columnWidths[key];
    },
    [preferences.columnWidths]
  );

  const resetColumnWidths = useCallback(() => {
    updatePreferences({ columnWidths: {} });
  }, [updatePreferences]);

  return {
    preferences,
    loaded,
    setTheme,
    setDensity,
    setColumnWidth,
    getColumnWidth,
    resetColumnWidths,
  };
}