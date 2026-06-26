#!/usr/bin/env node
/**
 * validate-invariants.mjs — Security Invariant CI Harness
 *
 * Work order: AGENT-030
 * Evidence:
 *   ci://tests/security/invariant-manifest-validation
 *   ci://tests/security/release-blocker-invariants
 *   ci://tests/security/evidence-uri-scheme-validation
 *
 * Parses invariants/security-invariants.yml and validates:
 *   1. All entries have required fields: id, title, category, severity, checkType, evidenceUri, owner
 *   2. All release_blocker severity invariants have non-empty evidence URIs
 *   3. Evidence URIs use only approved schemes: ci://, sql://, repo://, dashboard://
 *   4. Generates an ownership/severity summary report to stdout
 *   5. Exits with non-zero code if any validation fails
 *
 * Uses only Node.js built-in modules — no external YAML parser.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Approved evidence URI schemes per security-invariant-manifest.md */
const APPROVED_SCHEMES = ["ci://", "sql://", "repo://", "dashboard://"];

/** Required scalar fields on every invariant entry */
const REQUIRED_FIELDS = [
  "id",
  "title",
  "category",
  "severity",
  "checkType",
  "evidenceUri",
  "owner",
];

/**
 * Parse the flat-list YAML structure used by security-invariants.yml.
 *
 * The format is a simple key-value list under `invariants:`, where each item
 * starts with `- id:`. We handle this with line-by-line string matching
 * rather than a full YAML parser (the format is intentionally constrained).
 *
 * @param {string} content Raw file content
 * @returns {{ version: string, invariants: Array<Record<string, string>> }}
 */
function parseInvariantsYaml(content) {
  const lines = content.split("\n");
  const result = { version: "", invariants: [] };
  let current = null;

  for (const line of lines) {
    // Top-level scalar: version
    const versionMatch = line.match(/^version:\s*(.+)$/);
    if (versionMatch) {
      result.version = versionMatch[1].trim().replace(/^['"]|['"]$/g, "");
      continue;
    }

    // New list entry starts with `- id:`
    const newItemMatch = line.match(/^- id:\s*(.+)$/);
    if (newItemMatch) {
      if (current) {
        result.invariants.push(current);
      }
      current = { id: newItemMatch[1].trim() };
      continue;
    }

    // Continuation fields at two-space indent: `  key: value`
    if (current) {
      const fieldMatch = line.match(/^  (\w[\w]*?):\s*(.*)$/);
      if (fieldMatch) {
        const key = fieldMatch[1].trim();
        let value = fieldMatch[2].trim();
        // Strip surrounding quotes
        value = value.replace(/^['"]|['"]$/g, "");
        // Skip list-type fields (appliesTo) — not needed for validation
        if (key !== "appliesTo") {
          current[key] = value;
        }
      }
    }
  }

  // Push last entry
  if (current) {
    result.invariants.push(current);
  }

  return result;
}

/**
 * Validate a single invariant entry and return an array of error strings.
 *
 * @param {Record<string, string>} inv
 * @returns {string[]}
 */
function validateInvariant(inv) {
  const errors = [];
  const label = inv.id || "(unknown id)";

  // 1. Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!inv[field] || inv[field].trim() === "") {
      errors.push(`[${label}] Missing required field: ${field}`);
    }
  }

  // 2. Release blocker must have a non-empty evidenceUri
  if (inv.severity === "release_blocker") {
    if (!inv.evidenceUri || inv.evidenceUri.trim() === "") {
      errors.push(`[${label}] release_blocker invariant has no evidenceUri`);
    }
  }

  // 3. Evidence URI must use approved scheme
  if (inv.evidenceUri && inv.evidenceUri.trim() !== "") {
    const uri = inv.evidenceUri.trim();
    const hasApprovedScheme = APPROVED_SCHEMES.some((scheme) =>
      uri.startsWith(scheme)
    );
    if (!hasApprovedScheme) {
      errors.push(
        `[${label}] evidenceUri uses unapproved scheme: ${uri} ` +
          `(approved: ${APPROVED_SCHEMES.join(", ")})`
      );
    }
  }

  return errors;
}

/**
 * Print a summary table of all invariants.
 *
 * @param {Array<Record<string, string>>} invariants
 * @param {Map<string, string[]>} errorMap  invariant id → errors
 */
function printSummaryTable(invariants, errorMap) {
  // Column widths
  const colId = 14;
  const colSeverity = 18;
  const colCategory = 28;
  const colOwner = 36;
  const colEvidence = 14;

  const header =
    "ID".padEnd(colId) +
    "Severity".padEnd(colSeverity) +
    "Category".padEnd(colCategory) +
    "Owner".padEnd(colOwner) +
    "Evidence";
  const divider = "-".repeat(header.length + 6);

  console.log("\n" + divider);
  console.log("  SECURITY INVARIANT MANIFEST — Ownership & Severity Report");
  console.log(divider);
  console.log(header);
  console.log(divider);

  for (const inv of invariants) {
    const id = (inv.id || "?").padEnd(colId);
    const severity = (inv.severity || "?").padEnd(colSeverity);
    const category = (inv.category || "?").padEnd(colCategory);
    const owner = (inv.owner || "?").substring(0, colOwner - 2).padEnd(colOwner);
    const hasErrors = errorMap.has(inv.id) && errorMap.get(inv.id).length > 0;
    const evidenceStatus = hasErrors ? "FAIL" : "OK";

    console.log(`${id}${severity}${category}${owner}${evidenceStatus}`);
  }

  console.log(divider);
}

/**
 * Print aggregate statistics.
 *
 * @param {Array<Record<string, string>>} invariants
 * @param {string[]} allErrors
 */
function printStatistics(invariants, allErrors) {
  const severityCounts = {};
  const categoryCounts = {};

  for (const inv of invariants) {
    const sev = inv.severity || "unknown";
    severityCounts[sev] = (severityCounts[sev] || 0) + 1;
    const cat = inv.category || "unknown";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  console.log(`\nTotal invariants: ${invariants.length}`);
  console.log("By severity:");
  for (const [sev, count] of Object.entries(severityCounts).sort()) {
    console.log(`  ${sev}: ${count}`);
  }
  console.log("By category:");
  for (const [cat, count] of Object.entries(categoryCounts).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\nValidation errors: ${allErrors.length}`);
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const invariantsPath = path.join(repoRoot, "invariants", "security-invariants.yml");

  // 1. Read file
  if (!fs.existsSync(invariantsPath)) {
    console.error(`ERROR: Invariants file not found at ${invariantsPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(invariantsPath, "utf8");

  // 2. Parse
  const parsed = parseInvariantsYaml(content);
  if (parsed.invariants.length === 0) {
    console.error("ERROR: No invariants found in manifest");
    process.exit(1);
  }
  console.log(`Parsed ${parsed.invariants.length} invariants (version: ${parsed.version})`);

  // 3. Validate each entry
  /** @type {Map<string, string[]>} */
  const errorMap = new Map();
  /** @type {string[]} */
  const allErrors = [];

  for (const inv of parsed.invariants) {
    const errors = validateInvariant(inv);
    if (errors.length > 0) {
      errorMap.set(inv.id, errors);
      allErrors.push(...errors);
    }
  }

  // 4. Print summary table
  printSummaryTable(parsed.invariants, errorMap);

  // 5. Print aggregate statistics
  printStatistics(parsed.invariants, allErrors);

  // 6. Print errors if any
  if (allErrors.length > 0) {
    console.log("\n=== VALIDATION FAILURES ===");
    for (const err of allErrors) {
      console.error(`  ✗ ${err}`);
    }
    console.error(`\nResult: FAILED (${allErrors.length} error(s))`);
    process.exit(1);
  }

  console.log("\nResult: PASSED — all invariants validated successfully.");
  process.exit(0);
}

main();
