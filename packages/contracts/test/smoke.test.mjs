import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseMetaRowValues,
  buildWorkbookColumnsFromCells,
  augmentColumnsWithMeta,
} from "../src/grid-column.ts";
import {
  extractAffectsWorkbooksFromPayload,
  normalizeAffectsWorkbooks,
  withAffectsWorkbooks,
} from "../src/outbox-refresh.ts";

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

test("@erp/contracts package metadata is coherent", () => {
  assert.equal(pkg.name, "@erp/contracts");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "0.18.0");
});

test("@erp/contracts required bootstrap source stub exists", () => {
  assert.equal(fs.existsSync(path.join(cwd, "src/index.ts")), true, "missing src/index.ts");
  assert.equal(fs.existsSync(path.join(cwd, "src/grid-column.ts")), true, "missing src/grid-column.ts");
});

test("parseMetaRowValues parses enum and currency format meta", () => {
  const meta = parseMetaRowValues({
    __status_meta: "enum:DRAFT|CONFIRMED|SHIPPED",
    __unit_price_meta: "format:currency:2",
  });
  assert.deepEqual(meta.status, {
    type: "enum",
    enumOptions: ["DRAFT", "CONFIRMED", "SHIPPED"],
  });
  assert.deepEqual(meta.unit_price, {
    type: "number",
    format: "currency",
  });
});

test("buildWorkbookColumnsFromCells excludes meta rows and augments columns", () => {
  const columns = buildWorkbookColumnsFromCells([
    { row_id: "L1", column_id: "status", value_text: "DRAFT" },
    { row_id: "L1", column_id: "unit_price", value_text: "10.00" },
    { row_id: "_meta", column_id: "__status_meta", value_text: "enum:DRAFT|CONFIRMED" },
    { row_id: "_meta", column_id: "__unit_price_meta", value_text: "format:currency:2" },
  ]);
  const statusCol = columns.find((c) => c.columnId === "status");
  const priceCol = columns.find((c) => c.columnId === "unit_price");
  assert.equal(statusCol?.type, "enum");
  assert.deepEqual(statusCol?.enumOptions, ["DRAFT", "CONFIRMED"]);
  assert.equal(priceCol?.format, "currency");
  assert.equal(columns.some((c) => c.columnId.startsWith("__")), false);
});

test("augmentColumnsWithMeta merges protected flag", () => {
  const cols = augmentColumnsWithMeta(["status"], {
    status: { type: "enum", enumOptions: ["A"], protected: true, readOnly: true },
  });
  assert.equal(cols[0]?.protected, true);
  assert.equal(cols[0]?.readOnly, true);
});

test("extractAffectsWorkbooksFromPayload allowlists workbook ids", () => {
  const sales = "00000000-0000-0000-0000-000000000015";
  const inventory = "00000000-0000-0000-0000-000000000014";
  const ids = extractAffectsWorkbooksFromPayload(
    { affects_workbooks: [sales, inventory, "not-allowed"] },
    sales,
  );
  assert.deepEqual(ids, [sales, inventory]);
});

test("withAffectsWorkbooks deduplicates primary workbook", () => {
  const sales = "00000000-0000-0000-0000-000000000015";
  const inventory = "00000000-0000-0000-0000-000000000014";
  const body = withAffectsWorkbooks({ orderId: "SO-1" }, [sales, inventory, sales], sales);
  assert.deepEqual(body.affects_workbooks, [sales, inventory]);
  assert.equal(normalizeAffectsWorkbooks([], sales).join(","), sales);
});