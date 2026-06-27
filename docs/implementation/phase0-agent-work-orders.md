# Phase 0 AI Agent Work Orders

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Status:** Active work-order catalog

## How to use this file

Each work order is intended to become one PR. A work order may be split into smaller PRs, but must not be combined with unrelated work unless the Engineering Lead approves the combined scope.

Agents must read `docs/snapshot-v0.17.0.md`, `AGENTS.md`, `docs/implementation/ai-coding-agent-roadmap.md`, and the canonical docs listed in each work order before changing files. Work orders that touch covered command/outbox/ledger/retrieval boundaries must start from `docs/skeletons/`.

---

## AGENT-000 — Repository bootstrap and validation baseline

**Objective:** prove the repository can be validated from a clean checkout.

**Dependencies:** none.

**Canonical docs:**

```text
AGENTS.md
docs/pack-index.md
docs/maintenance/normative-source-map.md
docs/snapshot-v0.17.0.md
scripts/validate-pack.sh
.github/workflows/validate-pack.yml
```

**Allowed paths:**

```text
scripts/**
.github/workflows/**
package.json / pnpm-lock.yaml / package-lock.json / yarn.lock
docs/implementation/**
```

**Implementation steps:**

1. Run `bash scripts/validate-pack.sh`.
2. Add or confirm package scripts for lint, typecheck, unit tests, integration tests, and benchmarks.
3. Confirm CI workflow runs validation on Markdown/YAML/script changes.
4. Add a repository-local `agent:validate` command if a package manager exists.
5. Create a PR handoff note using the agent template.

**Required evidence:**

```text
ci://tests/process/agent-roadmap-present
ci://tests/process/agent-validation-command-present
ci://tests/process/agent-pr-template-present
```

**Acceptance criteria:**

```text
- clean checkout validation passes;
- CI validation workflow exists;
- no active spec/version drift;
- no duplicate requiredDocs;
- no active duplicate ADR/gate IDs.
```

**Stop conditions:** validator fails and fixing it would require weakening checks.

---

## AGENT-001 — Test harness and evidence URI mapping

**Objective:** make manifest evidence executable or explicitly stubbed with owner/date.

**Dependencies:** AGENT-000.

**Canonical docs:**

```text
tests/manifest.yml
invariants/security-invariants.yml
docs/qa/phase0-benchmark-plan.md
docs/qa/chaos-test-plan.md
```

**Implementation steps:**

1. Map every P0 `ci://` URI to a test file or test placeholder.
2. Add failing placeholders only where implementation is not started, and label them skipped with owner and gate.
3. Ensure release-blocker invariants are discoverable by CI.
4. Add a manifest coverage report command.

**Required evidence:**

```text
ci://tests/process/manifest-ci-uri-coverage
ci://tests/security/release-blocker-invariants
```

**Acceptance criteria:** every P0 evidence URI has an executable or intentionally skipped test with owner.

---

## AGENT-010 — Command log schema and migration

**Objective:** implement `command_log` with privacy, trace, idempotency, duplicate-pending, TTL, and ambiguity rules.

**Dependencies:** AGENT-001.

**Canonical docs:**

```text
docs/dev/command-lifecycle.md
docs/data/command-outbox-retention-partitioning.md
docs/security/command-log-privacy.md
docs/api/command-status.openapi.yml
```

**Allowed paths:**

```text
src/db/**
src/commands/**
tests/api/**
tests/sql/**
migrations/**
```

**Implementation steps:**

1. Add migration for `command_log` using canonical DDL.
2. Add indexes for TTL and user recent lookups.
3. Implement request hash and redacted response storage.
4. Add duplicate in-flight `COMMAND_PENDING` behavior.
5. Add TTL cleanup behavior that sets `ambiguous` only under the documented rule.

**Required evidence:**

```text
ci://tests/api/command-id-reuse-conflict
ci://tests/api/command-pending-duplicate
ci://tests/security/command-log-redaction
ci://tests/security/command-log-no-raw-request-body
ci://tests/api/command-status-ttl
```

**Acceptance criteria:** command identity and privacy tests pass; no raw request/secret/regulated payload is stored in `command_log`.

---

## AGENT-011 — Command status API

**Objective:** implement `GET /commands/{commandId}` and command status response semantics.

**Dependencies:** AGENT-010.

**Canonical docs:**

```text
docs/api/command-status.openapi.yml
docs/api/error-taxonomy.md
docs/dev/command-lifecycle.md
```

**Implementation steps:**

1. Implement status endpoint with tenant/user authorization.
2. Return committed/rejected/failed/received/ambiguous states.
3. Add `COMMAND_ID_REUSE_CONFLICT` and `COMMAND_PENDING` error/response paths.
4. Add trace/correlation fields to logs and response metadata where safe.

**Required evidence:**

```text
ci://tests/api/command-status-ttl
ci://tests/api/command-id-reuse-conflict
ci://tests/api/command-pending-duplicate
```

**Acceptance criteria:** lost-response client can recover terminal state without blind retry.

---

## AGENT-012 — Command transaction boundary and MVP NumericLedgerPort adapter

**Objective:** implement the Boundary A / Boundary B command pattern and ensure MVP numeric ledger movements participate in the same PostgreSQL transaction.

**Dependencies:** AGENT-010, AGENT-011.

**Canonical docs:**

```text
docs/dev/command-lifecycle.md
docs/dev/numeric-ledger-plane.md
docs/data/numeric-ledger-contract.md
invariants/sql/aud-001-command-audit-domain-outbox-correlation.sql
```

**Implementation steps:**

1. Implement command claim transaction.
2. Implement business mutation transaction.
3. Add `PostgresMvpNumericLedgerAdapter` behind `NumericLedgerPort`.
4. Insert current-state, audit, domain event, outbox event, numeric transfer/projection, and command terminal status in one transaction.
5. Ensure savepoints do not hide required write failures.
6. Add rollback tests proving no leaked partial writes.

**Required evidence:**

```text
ci://tests/command/transaction-boundary-atomic-current-audit-domain-outbox
ci://tests/command/numeric-ledger-port-postgres-adapter-participates-in-tx
ci://tests/command/boundary-b-rollback-leaves-no-audit-domain-outbox
ci://tests/sql/aud-001-command-audit-domain-outbox-correlation
ci://benchmarks/BENCH-CMD-TX-001
```

**Acceptance criteria:** MVP command transaction is atomic across current, audit, domain, outbox, command status, and MVP numeric ledger adapter writes.

---

## AGENT-013 — Client unknown-outcome and optimistic edit UX

**Objective:** implement client behavior for pending, committed, rejected, failed, and ambiguous command outcomes.

**Dependencies:** AGENT-011.

**Canonical docs:**

```text
docs/dev/client-optimistic-ui-and-conflicts.md
docs/dev/command-lifecycle.md
docs/api/command-status.openapi.yml
```

**Implementation steps:**

1. Add pending indicator with command ID where useful.
2. Poll command status after lost/timeout response.
3. Block blind retry after ambiguity.
4. Require refresh and explicit confirmation before retry.
5. Stop offline queue on ambiguity.

**Required evidence:**

```text
ci://tests/client/optimistic-ui-conflict-resolution
ci://tests/client/ambiguous-command-blocks-blind-retry
ci://tests/client/ambiguous-retry-after-refresh-confirmation
ci://tests/client/pending-indicator-command-id-visible
ci://tests/client/offline-queue-stops-on-ambiguity
```

---

## AGENT-020 — Outbox schema and event envelope

**Objective:** implement canonical `outbox_events`, event envelope fields, retention, and indexes.

**Dependencies:** AGENT-012.

**Canonical docs:**

```text
docs/data/command-outbox-retention-partitioning.md
docs/data/event-envelope-contract.md
docs/data/outbox-polling-performance-contract.md
```

**Implementation steps:**

1. Add `outbox_events` migration using canonical DDL.
2. Add covering poll indexes and tenant/workbook demand-filter indexes.
3. Add `event_id`, `command_event_seq`, `idempotency_key`, `route_key`, `partition_key`, `payload_hash`, `target_planes`, `data_classification`, and `permission_scope_hash`.
4. Add retention and full-refresh fallback tests.

**Required evidence:**

```text
ci://tests/data/outbox-schema-contract
ci://tests/data/outbox-schema-index-contract
ci://tests/data/outbox-retention-gap-forces-full-refresh
ci://tests/live-update/outbox-payload-hash-mismatch-blocks-delivery
```

---

## AGENT-021 — Polling-first outbox reader

**Objective:** implement durable high-watermark polling with demand filtering and payload budget enforcement.

**Dependencies:** AGENT-020.

**Canonical docs:**

```text
docs/dev/outbox-polling-reader.md
docs/data/outbox-polling-performance-contract.md
docs/gates/P0-LIVE-001-polling-first-outbox-live-updates.md
```

**Implementation steps:**

1. Implement high-watermark polling by `outbox_id`.
2. Fetch envelope metadata before payloads.
3. Demand-filter by local tenant/workbook subscriptions.
4. Enforce max events and bytes per poll.
5. Trigger `SYNC_REQUIRED` on retention gap, byte budget breach, or schema mismatch.
6. Save `EXPLAIN (ANALYZE, BUFFERS)` evidence for poll queries.

**Required evidence:**

```text
ci://tests/live-update/outbox-polling-replay
ci://tests/live-update/outbox-demand-filter-payload-fetch-minimized
ci://tests/live-update/outbox-payload-budget-full-refresh
ci://tests/live-update/outbox-explain-no-seq-scan
ci://benchmarks/BENCH-LIVE-OUTBOX-POLL-001
```

---

## AGENT-022 — SSE subscription handshake and recovery

**Objective:** implement initial snapshot, resume replay, and full-refresh fallback for live updates.

**Dependencies:** AGENT-021.

**Canonical docs:**

```text
docs/dev/outbox-polling-reader.md
docs/ops/outbox-wakeup-runbook.md
docs/data/outbox-polling-performance-contract.md
```

**Implementation steps:**

1. Add initial snapshot before live stream.
2. Add resume with high-watermark.
3. Add full-refresh fallback on retention gap or local outbox mismatch.
4. Deduplicate duplicate deliveries.

**Required evidence:**

```text
ci://tests/live-update/sse-subscription-handshake
ci://tests/live-update/full-refresh-fallback
ci://tests/live-update/wakeup-coalescing-no-duplicate-delivery
ci://tests/chaos/outbox-retention-gap-full-refresh
```

---

## AGENT-030 — Security invariant CI harness

**Objective:** make invariant manifest release-blockers executable in CI.

**Dependencies:** AGENT-001.

**Canonical docs:**

```text
invariants/security-invariants.yml
docs/dev/security-invariant-manifest.md
docs/gates/P0-INV-001-security-invariant-ci-enforcement.md
```

**Implementation steps:**

1. Parse invariant manifest.
2. Fail CI when release-blocker evidence is missing.
3. Validate evidence URI schemes.
4. Add ownership and severity report.

**Required evidence:**

```text
ci://tests/security/invariant-manifest-validation
ci://tests/security/release-blocker-invariants
ci://tests/security/evidence-uri-scheme-validation
```

---

## AGENT-031 — RLS and query compiler tenant isolation tests

**Objective:** prove tenant isolation before broader query features.

**Dependencies:** AGENT-030.

**Canonical docs:**

```text
invariants/security-invariants.yml
docs/security/threat-model-summary.md
docs/compliance/eu-dpa-dsr-matrix.md
```

**Implementation steps:**

1. Add tenant isolation fixtures.
2. Add RLS tests for operational reads and writes.
3. Add query compiler tests for field-level access.
4. Add negative tests for cross-tenant search and live-update delivery.

**Required evidence:**

```text
ci://tests/security/tenant-isolation-read
ci://tests/security/tenant-isolation-write
ci://tests/security/field-level-permission-query-compiler
```

---

## AGENT-040 — Transactional batch partition compiler

**Objective:** implement `BatchPartitionPolicy` compiler using connected components.

**Dependencies:** AGENT-012, AGENT-030.

**Canonical docs:**

```text
docs/dev/batch-partition-policy.md
docs/gates/P0-BATCH-001-transactional-batch-partition-validation.md
tests/fixtures/batch/inventory/positive.json
tests/fixtures/batch/inventory/negative.json
```

**Implementation steps:**

1. Parse partition policy.
2. Build mutation graph vertices.
3. Add edges for partition keys, FK, formula, aggregate, and custom domain rules.
4. Compute connected components with Union-Find.
5. Validate each component.
6. Fail closed on hidden dependency, timeout, missing fixture, or unknown field.

**Required evidence:**

```text
ci://tests/batch/partition-policy-validation
ci://tests/fuzz/batch-partitioner
ci://tests/batch/union-find-10k-compile-budget
ci://benchmarks/BENCH-BATCH-001
```

---

## AGENT-050 — Hot-path rate limiter

**Objective:** implement ordinary edit rate limiting without synchronous PostgreSQL counter writes.

**Dependencies:** AGENT-001.

**Canonical docs:**

```text
docs/dev/rate-limiter.md
docs/gates/P0-RATE-001-hot-path-rate-limit-safety.md
```

**Implementation steps:**

1. Implement edge/local token bucket shape.
2. Implement active instance heartbeat and budget division.
3. Add coarse PostgreSQL ceiling only for high-risk commands.
4. Add heartbeat cleanup and stale-instance worst-case tests.
5. Emit `Retry-After`, `RateLimit`, and `RateLimit-Policy` headers.

**Required evidence:**

```text
ci://tests/rate-limit/local-token-bucket
ci://tests/rate-limit/cross-instance-budget-division
ci://tests/rate-limit/no-ordinary-edit-pg-counter-write
ci://tests/rate-limit/credential-stuffing-throttled-before-edit-path
ci://benchmarks/BENCH-RATE-001
```

---

## AGENT-060 — Minimal spreadsheet edit UI vertical slice

**Objective:** implement the smallest spreadsheet-like UI surface needed to edit one safe cell.

**Dependencies:** AGENT-013, AGENT-022.

**Canonical docs:**

```text
docs/dev/client-optimistic-ui-and-conflicts.md
docs/plan/vertical-slice-acceptance-checklist.md
docs/ui/transposed-record-view-contract.md
```

**Implementation steps:**

1. Render one editable grid view backed by canonical field IDs.
2. Submit edit through command API.
3. Render pending/committed/rejected/ambiguous states.
4. Receive polling SSE update.
5. Implement refresh before retry on ambiguity.
6. Do not implement full tiling workspace.

**Required evidence:**

```text
ci://tests/e2e/vertical-slice/safe-cell-edit
ci://tests/ui/command-status-visible-in-tiles
ci://tests/client/ambiguous-requires-refresh
```

---

## AGENT-070 — Observability and trace propagation

**Objective:** add trace/correlation continuity across command, audit, domain, outbox, polling, SSE, and client state.

**Dependencies:** AGENT-012, AGENT-021.

**Canonical docs:**

```text
docs/observability/phase0-observability.md
docs/observability/otel-reference.yml
docs/observability/otel-reference-v0.13.3.yml
```

**Implementation steps:**

1. Add trace/correlation propagation through command lifecycle.
2. Add spans for command claim, business transaction, outbox insert, poll SQL, SSE delivery.
3. Add metrics named in the observability contract.
4. Add dashboard/alert placeholders.

**Required evidence:**

```text
ci://tests/observability/otel-reference-contract
ci://tests/observability/otel-reference-conventions
ci://benchmarks/BENCH-OBS-002
```

---

## AGENT-071 — Outbox polling performance evidence

**Objective:** prove envelope bloat and high-churn outbox data do not regress the MVP polling reader.

**Dependencies:** AGENT-021.

**Canonical docs:**

```text
docs/data/outbox-polling-performance-contract.md
docs/qa/outbox-fanout-benchmark-plan.md
docs/qa/chaos-test-plan.md
```

**Implementation steps:**

1. Generate 10k outbox events with realistic envelope sizes.
2. Simulate 100 concurrent SSE subscribers per instance.
3. Verify demand filtering avoids unnecessary payload fetches.
4. Record poll SQL p99, poll cycle p99, payload fetch p99.
5. Add high-churn bloat plus retention-gap chaos test.

**Required evidence:**

```text
ci://benchmarks/BENCH-LIVE-OUTBOX-POLL-001
ci://tests/chaos/outbox-bloat-high-churn-retention-gap
ci://tests/live-update/outbox-explain-no-seq-scan
```

---

## AGENT-080 — Integration staging preparedness only

**Objective:** add inert schemas/tests for integration staging safety without connector runtime.

**Dependencies:** AGENT-030, AGENT-012. Start only if it does not delay vertical slice.

**Canonical docs:**

```text
docs/data/external-integration-contract.md
docs/dev/external-integration-adapter.md
docs/security/integration-security-boundary.md
docs/security/integration-credential-management.md
```

**Implementation steps:**

1. Add staging schema only if approved for Phase 0 preparedness.
2. Add positive and negative fixtures.
3. Add validation function that blocks command proposal unless scan/schema/classification/service-account gates pass.
4. Do not call external systems.
5. Do not run connector workers in the MVP edit path.

**Required evidence:**

```text
ci://tests/integration/inbound-payload-scan-schema-validated-before-command-proposal
ci://tests/integration/staging-validation-gates-before-command-proposal
ci://tests/integration/revoked-credential-schema-mismatch-no-command-proposal
ci://tests/security/integration-credential-ref-no-secret-material
```

---

## AGENT-090 — Vertical slice acceptance package

**Objective:** assemble evidence and sign-off for the first safe cell edit.

**Dependencies:** AGENT-012, AGENT-022, AGENT-030, AGENT-050, AGENT-060, AGENT-070.

**Canonical docs:**

```text
docs/plan/vertical-slice-acceptance-checklist.md
docs/process/owner-signoff-template.md
docs/slo-baseline.yml
docs/slo-target-rationale.md
```

**Implementation steps:**

1. Run end-to-end vertical slice test.
2. Run P0-CMD and P0-LIVE evidence tests.
3. Capture SLO dataset metadata.
4. Fill owner sign-off template.
5. Record known gaps and waivers. No waiver is allowed for P0-CMD-001 or P0-LIVE-001.

**Required evidence:**

```text
ci://tests/e2e/vertical-slice/safe-cell-edit
ci://tests/e2e/TC-CMD-001-network-loss-after-commit
ci://tests/live-update/outbox-polling-replay
ci://tests/security/release-blocker-invariants
```

---

## AGENT-100 — Post-slice preparedness scaffolding only

**Objective:** after the vertical slice is green, add or refine inert interfaces and metadata hooks for post-MVP planes.

**Dependencies:** AGENT-090.

**Canonical docs:**

```text
docs/data/tigerbeetle-target-model.md
docs/data/pgvector-integration-strategy-options.md
docs/data/duckdb-analytics-plane.md
docs/data/external-integration-strategy-options.md
docs/ui/spreadsheet-tiled-workspace-strategy.md
```

**Allowed work:**

```text
- interface definitions
- schema metadata hooks
- feature flags defaulting off
- fixture generation
- docs and tests proving feature is not in MVP edit path
```

**Forbidden work:**

```text
- running post-MVP infrastructure in ordinary edit path
- AI suggestions that mutate without command confirmation
- DuckDB analytics as operational source of truth
- TigerBeetle authoritative cutover
- connector marketplace runtime
- full tiled workspace runtime
```

**Required evidence:**

```text
ci://tests/process/post-mvp-scaffolding-feature-flagged-off
ci://tests/process/no-post-mvp-plane-in-phase0-edit-path
```



## v0.17.0 repository bootstrap note

Agents must use `docs/implementation/project-directory-structure.md` and `docs/implementation/code-stub-index.md` before changing `apps/` or `packages/`.
