import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));

test("@erp/web package metadata is coherent", () => {
  assert.equal(pkg.name, "@erp/web");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.version, "0.16.1");
});

test("@erp/web required bootstrap source stub exists", () => {
  assert.equal(fs.existsSync(path.join(cwd, "src/app/page.tsx")), true, "missing src/app/page.tsx");
});
