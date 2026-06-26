import fs from "node:fs";
import path from "node:path";

function run() {
  const manifestPath = "tests/manifest.yml";
  const testPath = "tests/evidence.test.mjs";

  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest file not found: ${manifestPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(testPath)) {
    console.error(`Test file not found: ${testPath}`);
    process.exit(1);
  }

  const manifestContent = fs.readFileSync(manifestPath, "utf8");
  const testContent = fs.readFileSync(testPath, "utf8");

  // Extract ciJobs under P0 gates from manifest
  const p0Gates = ["P0-EXEC-001", "P0-CMD-001", "P0-LIVE-001", "P0-INV-001", "P0-BATCH-001", "P0-RATE-001"];
  const lines = manifestContent.split("\n");
  const p0Jobs = new Set();
  let currentGate = null;
  let inCiJobs = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- id:")) {
      currentGate = trimmed.substring(5).trim();
      inCiJobs = false;
    } else if (trimmed.startsWith("ciJobs:")) {
      inCiJobs = true;
    } else if (trimmed.startsWith("- ci://") && inCiJobs && currentGate && p0Gates.includes(currentGate)) {
      p0Jobs.add(trimmed.substring(2).trim());
    }
  }

  console.log(`\n=== Manifest CI URI Coverage Report (Phase 0) ===`);
  console.log(`Total expected Phase 0 URIs in manifest: ${p0Jobs.size}`);

  let coveredCount = 0;
  let missingCount = 0;
  const missing = [];

  for (const job of p0Jobs) {
    if (testContent.includes(job)) {
      coveredCount++;
    } else {
      missingCount++;
      missing.push(job);
    }
  }

  console.log(`Mapped in tests: ${coveredCount} (${Math.round((coveredCount / p0Jobs.size) * 100)}%)`);
  console.log(`Missing from tests: ${missingCount}`);

  if (missingCount > 0) {
    console.log("\nMissing URIs:");
    missing.forEach(m => console.log(` - ${m}`));
    process.exit(1);
  }

  console.log("\nCoverage validation: PASSED (100% of Phase 0 URIs are mapped).");
}

run();
