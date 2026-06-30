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
import {
  resolveEventWorkbookId,
  assertAllowedWorkbook,
  resolveWorkbooksToRefresh,
  resolveRelatedWorkbooksFromGraph,
  SYNC_REQUIRED_USER_MESSAGE,
} from "../src/lib/workbookUtils.ts";
import {
  isCommandFailure,
  isTerminalVisualState,
  lifecycleToVisualState,
  resolveEditVisualState,
} from "../src/lib/commandUtils.ts";
import { ALLOWED_WORKBOOKS } from "../src/lib/workbookConstants.ts";
import { COLUMN_WIDTH_DEFAULT, COLUMN_WIDTH_MAX, COLUMN_WIDTH_MIN } from "../src/lib/uiConstants.ts";
import {
  formatDisplayValue,
  isColumnEditable,
  columnUsesEnumSelect,
} from "../src/lib/columnMetaUtils.ts";

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

test("@erp/web package metadata is coherent", () => {
  assert.equal(pkg.name, "@erp/web");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "0.18.0");
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
    "src/hooks/useWorkbookState.ts",
    "src/hooks/useBusinessCommands.ts",
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
  const workbookHook = fs.readFileSync(path.join(cwd, "src/hooks/useWorkbookState.ts"), "utf8");
  const sse = fs.readFileSync(path.join(cwd, "src/lib/useSseSubscription.ts"), "utf8");
  assert.match(page, /const handshakeSentRef = useRef\(false\)/);
  assert.match(page, /handshakeSentRef\.current = false/);
  assert.match(workbookHook, /setEventBuffers/);
  assert.match(workbookHook, /sseReconnectEpoch/);
  assert.match(workbookHook, /handleRetrySync/);
  assert.doesNotMatch(workbookHook, /if \(!ok\) \{\s*setSnapshotLoaded/);
  assert.match(sse, /eventType === "SYNC_REQUIRED"[\s\S]*scheduleReconnect\(\)/);
  assert.match(sse, /lastEventIdRef\.current = baseWatermarkRef\.current/);
  assert.match(workbookHook, /handleRetrySync[\s\S]*setEventBuffers/);
  assert.match(workbookHook, /handleRetrySync[\s\S]*setSnapshotLoaded/);
});

test("@erp/web allowlist guards are wired at navigation and mutation entry points", () => {
  const workbookHook = fs.readFileSync(path.join(cwd, "src/hooks/useWorkbookState.ts"), "utf8");
  const tiled = fs.readFileSync(path.join(cwd, "src/components/TiledWorkspace.tsx"), "utf8");
  const explorer = fs.readFileSync(path.join(cwd, "src/components/ExplorerPanel.tsx"), "utf8");
  const graph = fs.readFileSync(path.join(cwd, "src/components/WorkbookGraph.tsx"), "utf8");
  assert.match(workbookHook, /assertAllowedWorkbook/);
  assert.match(tiled, /allowedWorkbookIds\.includes/);
  assert.match(explorer, /allowedWorkbookIds\.includes/);
  assert.match(graph, /allowedWorkbookIds\.includes/);
});

test("@erp/web command notices use error badge styling", () => {
  const page = fs.readFileSync(path.join(cwd, "src/app/page.tsx"), "utf8");
  assert.match(page, /commandNotice[\s\S]*CommandNotice/);
});

test("ci://tests/ui/command-status-visible-in-tiles — business statuses wired to tiles", () => {
  const page = fs.readFileSync(path.join(cwd, "src/app/page.tsx"), "utf8");
  const tiled = fs.readFileSync(path.join(cwd, "src/components/TiledWorkspace.tsx"), "utf8");
  const center = fs.readFileSync(path.join(cwd, "src/components/BusinessCommandCenter.tsx"), "utf8");

  assert.match(page, /useBusinessCommands/);
  assert.match(page, /businessActionStatuses=\{business\.businessActionStatuses\}/);
  assert.match(tiled, /businessActionStatuses/);
  assert.match(tiled, /statuses=\{businessActionStatuses\}/);
  assert.match(center, /ActionStatusCard/);
  assert.match(center, /status\.commandId/);
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

test("@erp/web resizable dividers are implemented in TiledWorkspace", () => {
  const tiled = fs.readFileSync(path.join(cwd, "src/components/TiledWorkspace.tsx"), "utf8");
  assert.match(tiled, /tile-divider/);
  assert.match(tiled, /handlePointerDown/);
  assert.match(tiled, /setPointerCapture/);
  assert.match(tiled, /releasePointerCapture/);
});

test("@erp/web resizer styles exist in globals.css", () => {
  const css = fs.readFileSync(path.join(cwd, "src/styles/globals.css"), "utf8");
  assert.match(css, /\.tile-divider/);
  assert.match(css, /\.tile-divider--row/);
  assert.match(css, /\.tile-divider--column/);
});

test("@erp/web range selection is implemented in SpreadsheetGrid", () => {
  const grid = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGrid.tsx"), "utf8");
  assert.match(grid, /selectionStart/);
  assert.match(grid, /selectionEnd/);
  assert.match(grid, /handleCellMouseDown/);
  assert.match(grid, /handleCellMouseEnter/);
  assert.match(grid, /getCellRangeClasses/);
});

test("@erp/web clipboard copy/paste is registered in SpreadsheetGrid", () => {
  const grid = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGrid.tsx"), "utf8");
  assert.match(grid, /document\.addEventListener\("copy"/);
  assert.match(grid, /document\.addEventListener\("paste"/);
  assert.match(grid, /e\.clipboardData/);
  assert.match(grid, /onCellEdit/);
});

test("@erp/web range selection styles exist in globals.css", () => {
  const css = fs.readFileSync(path.join(cwd, "src/styles/globals.css"), "utf8");
  assert.match(css, /\.spreadsheet-cell--in-range/);
  assert.match(css, /\.spreadsheet-cell--range-top/);
  assert.match(css, /\.spreadsheet-cell--range-bottom/);
  assert.match(css, /\.spreadsheet-cell--range-left/);
  assert.match(css, /\.spreadsheet-cell--range-right/);
});

test("ci://tests/ui/column-meta-renders-enum-select — grid wires CellValueEditor select", () => {
  const grid = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGrid.tsx"), "utf8");
  const editor = fs.readFileSync(
    path.join(cwd, "../../packages/ui/src/CellValueEditor.tsx"),
    "utf8"
  );
  const detail = fs.readFileSync(path.join(cwd, "src/components/TransposedDetail.tsx"), "utf8");
  assert.match(grid, /CellValueEditor/);
  assert.match(grid, /isColumnEditable/);
  assert.match(grid, /formatDisplayValue/);
  assert.match(editor, /<select/);
  assert.match(editor, /columnUsesEnumSelect/);
  assert.match(editor, /enumOptions/);
  assert.match(detail, /CellValueEditor/);
});

test("column meta utils format currency and guard protected columns", () => {
  const currencyCol = { columnId: "unit_price", label: "Unit Price", type: "number", format: "currency" };
  assert.match(formatDisplayValue("12.5", currencyCol), /\$12\.50/);
  assert.equal(isColumnEditable({ columnId: "status", label: "Status", protected: true }), false);
  assert.equal(
    columnUsesEnumSelect({
      columnId: "status",
      label: "Status",
      type: "enum",
      enumOptions: ["DRAFT", "SHIPPED"],
    }),
    true
  );
});

test("@erp/web protected column styles exist in globals.css", () => {
  const css = fs.readFileSync(path.join(cwd, "src/styles/globals.css"), "utf8");
  assert.match(css, /\.spreadsheet-cell--protected/);
  assert.match(css, /\.detail-field--protected/);
});

test("@erp/web server column meta discovery wired in api server", () => {
  const server = fs.readFileSync(path.join(cwd, "../../apps/api/src/server.ts"), "utf8");
  assert.match(server, /buildWorkbookColumnsFromCells/);
});

test("ci://tests/ui/cross-workbook-tile-refresh — resolves affects_workbooks fan-out", () => {
  const workbookHook = fs.readFileSync(path.join(cwd, "src/hooks/useWorkbookState.ts"), "utf8");
  const businessHook = fs.readFileSync(path.join(cwd, "src/hooks/useBusinessCommands.ts"), "utf8");
  assert.match(workbookHook, /resolveWorkbooksToRefresh/);
  assert.match(businessHook, /refreshWorkbookSet\(targets/);
  assert.match(workbookHook, /SYNC_REQUIRED_USER_MESSAGE/);

  const sales = "00000000-0000-0000-0000-000000000015";
  const inventory = "00000000-0000-0000-0000-000000000014";
  const targets = resolveWorkbooksToRefresh(
    { workbookId: sales, payload: { affects_workbooks: [sales, inventory] } },
    [],
    ALLOWED_WORKBOOKS,
  );
  assert.deepEqual(targets, [sales, inventory]);
});

test("resolveRelatedWorkbooksFromGraph uses non-contains edges", () => {
  const sales = "00000000-0000-0000-0000-000000000015";
  const inventory = "00000000-0000-0000-0000-000000000014";
  const related = resolveRelatedWorkbooksFromGraph(
    sales,
    [
      { source: sales, target: inventory, label: "reserves_stock_in" },
      { source: sales, target: "cat-1", label: "contains" },
    ],
    ALLOWED_WORKBOOKS,
  );
  assert.deepEqual(related, [inventory]);
});

test("SYNC_REQUIRED user message is stable copy", () => {
  assert.match(SYNC_REQUIRED_USER_MESSAGE, /out of sync with the server/i);
});

test("ci://tests/ui/sales-order-group-rendering — HDR/LINE grouping wired in grid", async () => {
  const grouping = await import("../src/lib/salesOrderGrouping.ts");
  const grid = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGrid.tsx"), "utf8");
  const css = fs.readFileSync(path.join(cwd, "src/styles/globals.css"), "utf8");

  const rows = [
    { rowId: "SO-001-HDR", values: { order_id: "SO-001", customer_id: "c1", status: "SHIPPED" } },
    { rowId: "SO-001-L1", values: { order_id: "SO-001", line_id: "1", qty: "2" } },
    { rowId: "SO-001-L2", values: { order_id: "SO-001", line_id: "2", qty: "1" } },
    { rowId: "SO-002-HDR", values: { order_id: "SO-002", customer_id: "c2", status: "DRAFT" } },
    { rowId: "SO-002-L1", values: { order_id: "SO-002", line_id: "1", qty: "4" } },
  ];

  assert.equal(grouping.isSalesOrderHeaderRow("SO-001-HDR"), true);
  assert.equal(grouping.isSalesOrderLineRow("SO-001-L1"), true);
  assert.equal(grouping.salesOrderGroupKey("SO-001-L2"), "SO-001");
  assert.equal(
    grouping.shouldGroupSalesOrders(grouping.SALES_ORDERS_WORKBOOK_ID, rows),
    true
  );

  const collapsed = new Set(["SO-001"]);
  const visible = grouping.applySalesOrderCollapse(rows, collapsed);
  assert.deepEqual(
    visible.map((r) => r.rowId),
    ["SO-001-HDR", "SO-002-HDR", "SO-002-L1"]
  );

  const groups = grouping.buildSalesOrderGroups(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].lines.length, 2);

  assert.match(grid, /shouldGroupSalesOrders/);
  assert.match(grid, /spreadsheet-row--group-header/);
  assert.match(grid, /summarizeSalesOrderHeader/);
  assert.match(grid, /toggleCollapsedGroup/);
  assert.match(css, /\.spreadsheet-row--group-header/);
  assert.match(css, /\.spreadsheet-group-summary/);
});

test("ci://benchmarks/BENCH-UX-001 — virtual window projection stays within SLO", async () => {
  const { runBenchUx001Projection, shouldVirtualizeGrid, VIRTUALIZATION_THRESHOLD } =
    await import("../src/lib/gridVirtualization.ts");
  const grid = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGrid.tsx"), "utf8");

  const bench = runBenchUx001Projection();
  assert.equal(bench.passed, true, `projection took ${bench.elapsedMs}ms`);
  assert.equal(bench.rowCount, 100_000);
  assert.equal(shouldVirtualizeGrid(VIRTUALIZATION_THRESHOLD), true);
  assert.equal(shouldVirtualizeGrid(VIRTUALIZATION_THRESHOLD - 1), false);

  assert.match(grid, /from "react-window"/);
  assert.match(grid, /shouldVirtualizeGrid/);
  assert.match(grid, /SpreadsheetVirtualRow/);
});

test("ci://tests/ui/glide-poc-cell-update-wiring — onCellEdited routes to onCellEdit", () => {
  const poc = fs.readFileSync(path.join(cwd, "src/components/SpreadsheetGridGlidePoc.tsx"), "utf8");
  assert.match(poc, /onCellEdited/);
  assert.match(poc, /onCellEdit\(rowId, columnId, value\)/);
  assert.match(poc, /cell\.update/);
  assert.match(poc, /commandStates/);
});