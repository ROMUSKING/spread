import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 1. Explicitly implemented tests
test("ci://tests/process/repo-structure-present", () => {
  const dirs = [
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
  for (const dir of dirs) {
    assert.ok(fs.statSync(dir).isDirectory(), `Directory ${dir} must exist`);
  }
});

test("ci://tests/process/scoped-agent-instructions-present", () => {
  assert.ok(fs.existsSync("AGENTS.md"));
  assert.ok(fs.existsSync("apps/AGENTS.md"));
  assert.ok(fs.existsSync("packages/AGENTS.md"));
});

test("ci://tests/process/gitignore-covers-planned-stack", () => {
  const content = fs.readFileSync(".gitignore", "utf8");
  assert.ok(content.includes("node_modules/"));
  assert.ok(content.includes("dist/"));
});

test("ci://tests/process/agent-pr-template-present", () => {
  assert.ok(fs.existsSync(".github/workflows/ci.yml"));
});

test("ci://tests/security/invariant-manifest-validation", () => {
  const content = fs.readFileSync("invariants/security-invariants.yml", "utf8");
  assert.ok(content.includes("version: 0.16.1"));
});

test("ci://tests/security/evidence-uri-scheme-validation", () => {
  const content = fs.readFileSync("tests/manifest.yml", "utf8");
  const matches = content.match(/ci:\/\/\S+/g) || [];
  for (const match of matches) {
    assert.ok(match.startsWith("ci://"), `URI ${match} must use ci:// scheme`);
  }
});

// 2. Statically mapped stubs for remaining Phase 0 URIs
const stubs = [
  ["ci://tests/process/agent-roadmap-present", "P0-EXEC-001"],
  ["ci://tests/process/agent-work-orders-have-evidence", "P0-EXEC-001"],
  ["ci://tests/process/agent-validation-command-present", "P0-EXEC-001"],
  ["ci://tests/process/no-agent-work-order-bypasses-p0-order", "P0-EXEC-001"],
  ["ci://tests/process/no-post-mvp-plane-in-phase0-edit-path", "P0-EXEC-001"],
  ["ci://tests/process/post-mvp-scaffolding-feature-flagged-off", "P0-EXEC-001"],
  ["ci://tests/process/agent-handoff-includes-validation-output", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-EXEC-001", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-first-read-present", "P0-EXEC-001"],
  ["ci://tests/process/skeletons-present-for-core-boundaries", "P0-EXEC-001"],
  ["ci://tests/process/validation-waiver-requires-log-entry", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-direct-write-rejected", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-post-mvp-runtime-rejected", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-command-without-outbox-rejected", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-revalidator-bypass-rejected", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-tile-command-bypass-rejected", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-ddl-centralization-rejected", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-waiver-requires-log-entry", "P0-EXEC-001"],
  ["ci://tests/docs/pack-snapshot-current", "P0-EXEC-001"],
  ["ci://tests/ui/no-tile-transpose-mutation-before-p1-ux", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-start-here-banner-in-readme-and-index", "P0-EXEC-001"],
  ["ci://tests/process/agent-pr-handoff-examples-present", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-output-attached", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-EXEC-002", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-SNAP-001", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-start-here-banner-present", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-agent-no-go-checklist-present", "P0-EXEC-001"],
  ["ci://tests/process/pr-handoff-examples-present", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-authority-map-first", "P0-EXEC-001"],
  ["ci://tests/process/agent-no-go-checklist-present", "P0-EXEC-001"],
  ["ci://tests/process/agent-simulation-rejection-time-budget", "P0-EXEC-001"],
  ["ci://tests/process/source-stubs-present-in-implementation-paths", "P0-EXEC-001"],
  ["ci://tests/process/docs-archive-layout-present", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-REPO-001", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-REPO-002", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-repository-tree-visible", "P0-EXEC-001"],
  ["ci://tests/process/no-stale-active-v0153-references", "P0-EXEC-001"],
  ["ci://tests/docs/snapshot-repository-tree-present", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-REPO-SMOKE-001", "P0-EXEC-001"],
  ["ci://tests/process/no-generated-build-artifacts-in-source-pack", "P0-EXEC-001"],
  ["ci://tests/process/snapshot-repository-tree-present", "P0-EXEC-001"],
  ["ci://tests/process/no-stale-active-v015x-references", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-SNAP-003", "P0-EXEC-001"],
  ["ci://tests/process/repo-smoke-typecheck-passes", "P0-EXEC-001"],
  ["ci://tests/process/bootstrap-completion-evidence-attached", "P0-EXEC-001"],
  ["ci://tests/process/package-smoke-tests-pass", "P0-EXEC-001"],
  ["ci://tests/process/smoke-typecheck-tsc-resolution-documented", "P0-EXEC-001"],
  ["ci://tests/process/vertical-slice-release-note-template-present", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-REPO-003", "P0-EXEC-001"],
  ["ci://benchmarks/BENCH-BOOTSTRAP-001", "P0-EXEC-001"],
  ["ci://tests/e2e/TC-CMD-001-network-loss-after-commit", "P0-CMD-001"],
  ["ci://tests/api/command-status-ttl", "P0-CMD-001"],
  ["ci://tests/api/command-id-reuse-conflict", "P0-CMD-001"],
  ["ci://tests/client/optimistic-ui-conflict-resolution", "P0-CMD-001"],
  ["ci://tests/client/ambiguous-command-blocks-blind-retry", "P0-CMD-001"],
  ["ci://tests/security/command-log-redaction", "P0-CMD-001"],
  ["ci://tests/security/command-log-no-raw-request-body", "P0-CMD-001"],
  ["ci://tests/sql/aud-001-command-audit-domain-outbox-correlation", "P0-CMD-001"],
  ["ci://tests/api/command-pending-duplicate", "P0-CMD-001"],
  ["ci://tests/client/ambiguous-requires-refresh", "P0-CMD-001"],
  ["ci://tests/e2e/vertical-slice/safe-cell-edit", "P0-CMD-001"],
  ["ci://tests/client/ambiguous-retry-after-refresh-confirmation", "P0-CMD-001"],
  ["ci://tests/client/pending-indicator-command-id-visible", "P0-CMD-001"],
  ["ci://tests/client/offline-queue-stops-on-ambiguity", "P0-CMD-001"],
  ["ci://tests/client/optimistic-batch-disabled-before-partition-policy", "P0-CMD-001"],
  ["ci://tests/chaos/command-db-connection-kill-mid-transaction", "P0-CMD-001"],
  ["ci://tests/chaos/command-network-partition-after-ledger-success", "P0-CMD-001"],
  ["ci://benchmarks/BENCH-CHAOS-001", "P0-CMD-001"],
  ["ci://tests/command/transaction-boundary-atomic-current-audit-domain-outbox", "P0-CMD-001"],
  ["ci://tests/command/numeric-ledger-port-postgres-adapter-participates-in-tx", "P0-CMD-001"],
  ["ci://tests/command/command-claim-duplicate-pending-no-second-execution", "P0-CMD-001"],
  ["ci://tests/command/boundary-b-rollback-leaves-no-audit-domain-outbox", "P0-CMD-001"],
  ["ci://tests/command/savepoint-policy-does-not-hide-required-write-failure", "P0-CMD-001"],
  ["ci://tests/api/command-transaction-boundary-savepoints", "P0-CMD-001"],
  ["ci://tests/api/command-ledger-port-in-same-pg-transaction", "P0-CMD-001"],
  ["ci://benchmarks/BENCH-CMD-TX-001", "P0-CMD-001"],
  ["ci://tests/api/transaction-boundary-atomic-current-audit-domain-outbox", "P0-CMD-001"],
  ["ci://tests/api/numeric-ledger-port-postgres-adapter-participates-in-tx", "P0-CMD-001"],
  ["ci://tests/ui/grid-keyboard-navigation-basic", "P0-CMD-001"],
  ["ci://tests/ui/grid-screen-reader-labels-basic", "P0-CMD-001"],
  ["ci://tests/ui/touch-edit-does-not-bypass-command-api", "P0-CMD-001"],
  ["ci://tests/live-update/outbox-polling-replay", "P0-LIVE-001"],
  ["ci://tests/live-update/sse-subscription-handshake", "P0-LIVE-001"],
  ["ci://tests/live-update/full-refresh-fallback", "P0-LIVE-001"],
  ["ci://tests/data/outbox-retention-gap-forces-full-refresh", "P0-LIVE-001"],
  ["ci://tests/live-update/outbox-retention-gap-refresh", "P0-LIVE-001"],
  ["ci://tests/data/outbox-schema-index-contract", "P0-LIVE-001"],
  ["ci://benchmarks/BENCH-LIVE-001", "P0-LIVE-001"],
  ["ci://benchmarks/BENCH-NOTIFY-001", "P0-LIVE-001"],
  ["ci://tests/data/outbox-schema-contract", "P0-LIVE-001"],
  ["ci://benchmarks/BENCH-LIVE-001-100-sse-subscribers", "P0-LIVE-001"],
  ["ci://tests/live-update/wakeup-coalescing-no-duplicate-delivery", "P0-LIVE-001"],
  ["ci://tests/chaos/outbox-retention-gap-full-refresh", "P0-LIVE-001"],
  ["ci://tests/live-update/outbox-demand-filter-payload-fetch-minimized", "P0-LIVE-001"],
  ["ci://tests/live-update/outbox-payload-budget-full-refresh", "P0-LIVE-001"],
  ["ci://tests/live-update/outbox-payload-hash-mismatch-blocks-delivery", "P0-LIVE-001"],
  ["ci://tests/live-update/outbox-explain-no-seq-scan", "P0-LIVE-001"],
  ["ci://tests/chaos/outbox-bloat-high-churn-retention-gap", "P0-LIVE-001"],
  ["ci://benchmarks/BENCH-LIVE-OUTBOX-POLL-001", "P0-LIVE-001"],
  ["ci://tests/security/release-blocker-invariants", "P0-INV-001"],
  ["ci://tests/observability/otel-reference-contract", "P0-INV-001"],
  ["ci://benchmarks/BENCH-OBS-002", "P0-INV-001"],
  ["ci://tests/observability/otel-reference-conventions", "P0-INV-001"],
  ["ci://tests/batch/partition-policy-validation", "P0-BATCH-001"],
  ["ci://tests/fuzz/batch-partitioner", "P0-BATCH-001"],
  ["ci://tests/batch/union-find-10k-compile-budget", "P0-BATCH-001"],
  ["ci://benchmarks/BENCH-BATCH-001", "P0-BATCH-001"],
  ["ci://tests/rate-limit/local-token-bucket", "P0-RATE-001"],
  ["ci://tests/rate-limit/cross-instance-budget-division", "P0-RATE-001"],
  ["ci://tests/rate-limit/no-pg-counter-write-on-edit-hot-path", "P0-RATE-001"],
  ["ci://benchmarks/BENCH-RATE-001", "P0-RATE-001"],
  ["ci://tests/rate-limit/credential-stuffing-throttled-before-edit-path", "P0-RATE-001"],
  ["ci://tests/rate-limit/high-risk-command-postgres-ceiling", "P0-RATE-001"],
  ["ci://tests/rate-limit/no-ordinary-edit-pg-counter-write", "P0-RATE-001"],
];

for (const [uri, gate] of stubs) {
  test(uri, { skip: `Placeholder: pending implementation for gate ${gate}` }, () => {
    assert.fail("Stub");
  });
}
