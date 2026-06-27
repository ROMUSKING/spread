import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

test("@erp/api package metadata is coherent", () => {
  assert.equal(pkg.name, "@erp/api");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "0.17.0");
});

test("@erp/api required bootstrap source stub exists", () => {
  assert.equal(fs.existsSync(path.join(cwd, "src/index.ts")), true, "missing src/index.ts");
});
