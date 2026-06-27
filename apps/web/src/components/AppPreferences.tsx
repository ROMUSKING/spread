"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Theme, Density } from "../lib/usePreferences";

interface AppPreferencesProps {
  theme: Theme;
  density: Density;
  onThemeChange: (theme: Theme) => void;
  onDensityChange: (density: Density) => void;
  onResetColumnWidths: () => void;
}

const DIALOG_FOCUSABLE =
  '.prefs-panel button:not([disabled]), .prefs-panel [href], .prefs-panel input:not([disabled]), .prefs-panel select:not([disabled]), .prefs-panel textarea:not([disabled]), .prefs-panel [tabindex]:not([tabindex="-1"])';

export function AppPreferences({
  theme,
  density,
  onThemeChange,
  onDensityChange,
  onResetColumnWidths,
}: AppPreferencesProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    const firstControl = dialogRef.current?.querySelector<HTMLElement>(DIALOG_FOCUSABLE);
    firstControl?.focus();

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        className="btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Display
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="prefs-panel"
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50 }}
          role="dialog"
          aria-modal="true"
          aria-label="Display preferences"
        >
          <div className="prefs-row">
            <span className="prefs-label">Theme</span>
            <div className="prefs-options">
              <button
                type="button"
                className={`btn ${theme === "dark" ? "btn--active" : ""}`}
                onClick={() => onThemeChange("dark")}
              >
                Dark
              </button>
              <button
                type="button"
                className={`btn ${theme === "light" ? "btn--active" : ""}`}
                onClick={() => onThemeChange("light")}
              >
                Light
              </button>
            </div>
          </div>

          <div className="prefs-row">
            <span className="prefs-label">Density</span>
            <div className="prefs-options">
              <button
                type="button"
                className={`btn ${density === "comfortable" ? "btn--active" : ""}`}
                onClick={() => onDensityChange("comfortable")}
              >
                Comfortable
              </button>
              <button
                type="button"
                className={`btn ${density === "compact" ? "btn--active" : ""}`}
                onClick={() => onDensityChange("compact")}
              >
                Compact
              </button>
            </div>
          </div>

          <div className="prefs-row">
            <span className="prefs-label">Columns</span>
            <button type="button" className="btn btn--ghost" onClick={onResetColumnWidths}>
              Reset all column widths
            </button>
          </div>
        </div>
      )}
    </div>
  );
}