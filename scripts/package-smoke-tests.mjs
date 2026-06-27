import { spawnSync } from "node:child_process";
import path from "node:path";

const packages = [
  "apps/api",
  "apps/web",
  "packages/domain",
  "packages/db",
  "packages/contracts",
  "packages/config",
  "packages/observability",
  "packages/testkit",
  "packages/ui",
];

for (const pkg of packages) {
  const testArgs =
    pkg === "apps/web"
      ? ["--experimental-strip-types", "--test", "test/smoke.test.mjs"]
      : ["--test", "test/smoke.test.mjs"];
  const result = spawnSync(process.execPath, testArgs, {
    cwd: path.resolve(pkg),
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Package smoke tests passed.");
