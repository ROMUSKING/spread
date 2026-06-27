import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  clampColumnWidth,
  columnWidthKey,
  normalizeColumnWidths,
  readStoredPreferences,
  buildPreferencesBootstrapScript,
  PREFERENCES_STORAGE_KEY,
} from "../src/lib/preferencesUtils.ts";
import { cellStatusClass, resolveColumnWidth } from "../src/lib/gridUtils.ts";
import { resolveEventWorkbookId, assertAllowedWorkbook } from "../src/lib/workbookUtils.ts";
import {
  isCommandFailure,
  isTerminalVisualState,
  lifecycleToVisualState,
  resolveEditVisualState,
} from "../src/lib/commandUtils.ts";
import { ALLOWED_WORKBOOKS } from "../src/lib/workbookConstants.ts";
import { COLUMN_WIDTH_DEFAULT, COLUMN_WIDTH_MAX, COLUMN_WIDTH_MIN } from "../src/lib/uiConstants.ts";

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

test("@erp/web package metadata is coherent", () => {
  assert.equal(pkg.name, "@erp/web");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "0.17.0");
});

test("@erp/web required bootstrap source stub exists", () => {
  assert.equal(fs.existsSync(path.join(cwd, "src/app/page.tsx")), true, "missing src/app/page.tsx");
});

test("@erp/web UI preference and style files exist", () => {
  const required = [
    "src/lib/usePreferences.ts",
    "src/lib/preferencesUtils.ts",
    "src/lib/gridUtils.ts",
    "src/lib/workbookUtils.ts",
    "src/lib/commandUtils.ts",
    "src/lib/emptyStateCopy.ts",
    "src/components/AppPreferences.tsx",
    "src/styles/globals.css",
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(cwd, rel)), true, `missing ${rel}`);
  }
});

test("@erp/web wires AppPreferences in page shell", () => {
  const page = fs.readFileSync(path.join(cwd, "src/app/page.tsx"), "utf8");
  assert.match(page, /AppPreferences/);
  assert.match(page, /preferencesLoaded/);
  assert.match(page, /onResetColumnWidths/);
  assert.match(page, /Retry sync/);
});

test("columnWidthKey joins workbook and column ids", () => {
  assert.equal(columnWidthKey("wb-1", "qty"), "wb-1:qty");
});

test("clampColumnWidth enforces bounds and rounds", () => {
  assert.equal(clampColumnWidth(50), COLUMN_WIDTH_MIN);
  assert.equal(clampColumnWidth(500), COLUMN_WIDTH_MAX);
  assert.equal(clampColumnWidth(125.6), 126);
  assert.equal(clampColumnWidth(Number.NaN), COLUMN_WIDTH_DEFAULT);
});

test("normalizeColumnWidths drops invalid entries", () => {
  assert.deepEqual(
    normalizeColumnWidths({
      "wb:a": 140,
      "wb:b": "bad",
      "wb:c": Number.POSITIVE_INFINITY,
      "wb:d": 10,
    }),
    { "wb:a": 140, "wb:d": COLUMN_WIDTH_MIN }
  );
});

test("readStoredPreferences coerces theme/density and validates widths", () => {
  const storage = {
    getItem(key) {
      if (key !== PREFERENCES_STORAGE_KEY) return null;
      return JSON.stringify({
        theme: "light",
        density: "compact",
        columnWidths: { "wb:col": 9999, bad: "x" },
      });
    },
  };
  const prefs = readStoredPreferences(PREFERENCES_STORAGE_KEY, storage);
  assert.equal(prefs.theme, "light");
  assert.equal(prefs.density, "compact");
  assert.equal(prefs.columnWidths["wb:col"], COLUMN_WIDTH_MAX);
  assert.equal(prefs.columnWidths.bad, undefined);
});

test("readStoredPreferences returns defaults on malformed JSON", () => {
  const storage = { getItem: () => "{not-json" };
  const prefs = readStoredPreferences(PREFERENCES_STORAGE_KEY, storage);
  assert.equal(prefs.theme, "dark");
  assert.equal(prefs.density, "comfortable");
  assert.deepEqual(prefs.columnWidths, {});
});

test("readStoredPreferences returns defaults when storage is null", () => {
  const prefs = readStoredPreferences(PREFERENCES_STORAGE_KEY, null);
  assert.equal(prefs.theme, "dark");
  assert.equal(prefs.density, "comfortable");
  assert.deepEqual(prefs.columnWidths, {});
});

test("readStoredPreferences returns defaults when storage value is null", () => {
  const storage = { getItem: () => null };
  const prefs = readStoredPreferences(PREFERENCES_STORAGE_KEY, storage);
  assert.equal(prefs.theme, "dark");
  assert.equal(prefs.density, "comfortable");
});

test("readStoredPreferences coerces invalid theme and density to defaults", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({
        theme: "neon",
        density: "spacious",
        columnWidths: {},
      }),
  };
  const prefs = readStoredPreferences(PREFERENCES_STORAGE_KEY, storage);
  assert.equal(prefs.theme, "dark");
  assert.equal(prefs.density, "comfortable");
});

test("cellStatusClass maps command states to css classes", () => {
  assert.equal(cellStatusClass("pending"), "spreadsheet-cell--pending");
  assert.equal(cellStatusClass("committed"), "spreadsheet-cell--committed");
  assert.equal(cellStatusClass("rejected"), "spreadsheet-cell--rejected");
  assert.equal(cellStatusClass("ambiguous_requires_refresh"), "spreadsheet-cell--ambiguous");
  assert.equal(cellStatusClass(undefined), "");
});

test("resolveColumnWidth prefers draft then stored then default", () => {
  const getter = (wb, col) => (wb === "wb" && col === "a" ? 180 : undefined);
  assert.equal(resolveColumnWidth("a", "wb", getter, { a: 200 }), 200);
  assert.equal(resolveColumnWidth("a", "wb", getter, {}), 180);
  assert.equal(resolveColumnWidth("missing", "wb", getter, {}), COLUMN_WIDTH_DEFAULT);
});

test("resolveEventWorkbookId requires allowlisted workbookId", () => {
  assert.equal(resolveEventWorkbookId({ workbookId: ALLOWED_WORKBOOKS[0] }), ALLOWED_WORKBOOKS[0]);
  assert.equal(resolveEventWorkbookId({ workbookId: "not-allowed" }), null);
  assert.equal(resolveEventWorkbookId({}), null);
});

test("assertAllowedWorkbook guards mutation entry points", () => {
  assert.equal(assertAllowedWorkbook(ALLOWED_WORKBOOKS[0]), true);
  assert.equal(assertAllowedWorkbook("wb-unknown"), false);
});

test("lifecycleToVisualState maps submit outcomes", () => {
  assert.equal(lifecycleToVisualState("committed"), "committed");
  assert.equal(lifecycleToVisualState("rejected"), "rejected");
  assert.equal(lifecycleToVisualState("ambiguous_requires_refresh"), "ambiguous_requires_refresh");
  assert.equal(lifecycleToVisualState("command_pending"), "pending");
  assert.equal(lifecycleToVisualState("locally_pending"), "pending");
  assert.equal(lifecycleToVisualState("failed"), "rejected");
  assert.equal(lifecycleToVisualState("idle"), null);
  assert.equal(isCommandFailure("failed"), true);
});

test("isTerminalVisualState identifies persisted per-edit states", () => {
  assert.equal(isTerminalVisualState("committed"), true);
  assert.equal(isTerminalVisualState("rejected"), true);
  assert.equal(isTerminalVisualState("ambiguous_requires_refresh"), true);
  assert.equal(isTerminalVisualState("pending"), false);
});

test("resolveEditVisualState preserves terminal per-edit state from unrelated hook", () => {
  assert.equal(
    resolveEditVisualState("committed", "cmd-a", "cmd-b", "command_pending"),
    "committed"
  );
  assert.equal(
    resolveEditVisualState("ambiguous_requires_refresh", "cmd-a", "cmd-b", "committed"),
    "ambiguous_requires_refresh"
  );
});

test("resolveEditVisualState upgrades pending edit from matching hook", () => {
  assert.equal(
    resolveEditVisualState("pending", "cmd-a", "cmd-a", "command_pending"),
    "pending"
  );
  assert.equal(
    resolveEditVisualState("pending", "cmd-a", "cmd-a", "committed"),
    "committed"
  );
});

test("resolveEditVisualState overwrites terminal edit when hook is also terminal", () => {
  assert.equal(
    resolveEditVisualState("ambiguous_requires_refresh", "cmd-a", "cmd-a", "committed"),
    "committed"
  );
  assert.equal(
    resolveEditVisualState("committed", "cmd-a", "cmd-a", "rejected"),
    "rejected"
  );
});

test("@erp/web SSE handshake resets on sync required", () => {
  const page = fs.readFileSync(path.join(cwd, "src/app/page.tsx"), "utf8");
  const sse = fs.readFileSync(path.join(cwd, "src/lib/useSseSubscription.ts"), "utf8");
  assert.match(page, /const handshakeSentRef = useRef\(false\)/);
  assert.match(page, /handshakeSentRef\.current = false/);
  assert.match(page, /setEventBuffers/);
  assert.match(page, /sseReconnectEpoch/);
  assert.match(page, /handleRetrySync/);
  assert.doesNotMatch(page, /if \(!ok\) \{\s*setSnapshotLoaded/);
  assert.match(sse, /eventType === "SYNC_REQUIRED"[\s\S]*scheduleReconnect\(\)/);
  assert.match(sse, /lastEventIdRef\.current = baseWatermarkRef\.current/);
  assert.match(page, /handleRetrySync[\s\S]*setEventBuffers/);
  assert.match(page, /handleRetrySync[\s\S]*setSnapshotLoaded/);
});

test("@erp/web allowlist guards are wired at navigation and mutation entry points", () => {
  const page = fs.readFileSync(path.join(cwd, "src/app/page.tsx"), "utf8");
  const tiled = fs.readFileSync(path.join(cwd, "src/components/TiledWorkspace.tsx"), "utf8");
  const explorer = fs.readFileSync(path.join(cwd, "src/components/ExplorerPanel.tsx"), "utf8");
  const graph = fs.readFileSync(path.join(cwd, "src/components/WorkbookGraph.tsx"), "utf8");
  assert.match(page, /assertAllowedWorkbook/);
  assert.match(tiled, /allowedWorkbookIds\.includes/);
  assert.match(explorer, /allowedWorkbookIds\.includes/);
  assert.match(graph, /allowedWorkbookIds\.includes/);
});

test("@erp/web command notices use error badge styling", () => {
  const page = fs.readFileSync(path.join(cwd, "src/app/page.tsx"), "utf8");
  assert.match(page, /commandNotice[\s\S]*status-badge--danger/);
});

test("@erp/web spreadsheet resize clears body class on unmount", () => {
  const grid = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGrid.tsx"), "utf8");
  assert.match(grid, /document\.body\.classList\.remove\("spreadsheet-resizing"\)/);
});

test("empty state copy is centralized", () => {
  const copy = fs.readFileSync(path.join(cwd, "src/lib/emptyStateCopy.ts"), "utf8");
  for (const key of ["explorer", "graph", "detail", "grid"]) {
    assert.match(copy, new RegExp(`${key}:`));
    assert.match(copy, /title:/);
    assert.match(copy, /hint:/);
  }
});

test("preferences bootstrap script is inlined in layout", () => {
  const layout = fs.readFileSync(path.join(cwd, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /buildPreferencesBootstrapScript/);
  assert.match(layout, /dangerouslySetInnerHTML/);
  const script = buildPreferencesBootstrapScript();
  assert.match(script, /spread-erp-ui-preferences/);
});