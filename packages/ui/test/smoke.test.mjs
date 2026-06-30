import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

test("@erp/ui package metadata is coherent", () => {
  assert.equal(pkg.name, "@erp/ui");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "0.18.0");
});

test("@erp/ui required bootstrap source stub exists", () => {
  assert.equal(fs.existsSync(path.join(cwd, "src/index.ts")), true, "missing src/index.ts");
});

test("@erp/ui exports shared spreadsheet UI primitives", () => {
  for (const rel of [
    "src/CellValueEditor.tsx",
    "src/StatusBadge.tsx",
    "src/CommandNotice.tsx",
    "src/columnMetaUtils.ts",
  ]) {
    assert.equal(fs.existsSync(path.join(cwd, rel)), true, `missing ${rel}`);
  }
  const index = fs.readFileSync(path.join(cwd, "src/index.ts"), "utf8");
  assert.match(index, /CellValueEditor/);
  assert.match(index, /StatusBadge/);
  assert.match(index, /CommandNotice/);
});
