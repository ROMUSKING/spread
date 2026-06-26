# Spreadsheet-Native ERP Technical Specification v0.14

**Date:** 2026-06-26  
**Status:** Phase 0 implementation-readiness baseline with post-MVP external-system integration strategy  
**Supersedes:** v0.12.3 kickoff-ready baseline, v0.12.2 refined baseline, v0.12.1 externally integrated baseline, and v0.11 enforcement and operational-boundary baseline  
**Version note:** This is **v0.14**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, security, QA, SRE, compliance, product, and domain owners.  
**Pack entry point:** `docs/pack-index.md`  
**Quantified SLOs:** `docs/slo-baseline.yml`

---

## 1. Executive Summary

Version 0.13 converts the research findings and accumulated critical reviews into an execution-ready Phase 0 documentation baseline. The core product thesis remains unchanged: build a TypeScript-first, PostgreSQL-backed, spreadsheet-native ERP where every visible cell is a permissioned, validated, auditable projection of normalized business data.

The v0.13 refinement keeps the v0.12.3 safety and kickoff posture, then adds a numeric ledger plane strategy: TigerBeetle is the explicit post-MVP target for conserved numeric movement, while MVP stays PostgreSQL-backed but uses a TigerBeetle-shaped append-only account/transfer model through `NumericLedgerPort`. v0.13 also locks the TigerBeetle field assignment policy: the accepted model is hybrid, with dimension-centric accounts, movement-group-centric transfers, and PostgreSQL as the semantic index catalog.

The original v0.12 procedural change remains: Phase 0 should no longer begin with general feature construction. It should begin with five evidence-producing workstreams that prove the system can safely mutate data, recover from ambiguous outcomes, stream updates without harming commit latency, enforce invariants through CI, and validate transactional-batch partitions. The research also changes the live-update default: `LISTEN/NOTIFY` is now treated as an optional wake-up optimization, not the Phase 0 default. Durable outbox polling with jitter and local-subscriber filtering is the default until benchmark evidence proves `NOTIFY` safe for the target PostgreSQL distribution and workload.

The Phase 0 sequence is now (locked):

**Vertical Slice Requirement (mandatory v0.13)**: Single safe cell edit must complete end-to-end (command → outbox polling → SSE → recovery) before further editable-cell work.

```text
1. Command log + idempotency + unknown-outcome recovery.
2. Durable outbox polling + optional NOTIFY benchmark gate.
3. Security invariant manifest + CI enforcement.
4. Transactional-batch partition policy compiler and fuzz tests.
5. Hot-path rate limiting without synchronous PostgreSQL counters.
6. Formula worker warm-up and data-movement benchmark.
7. ADR/DAR completion and compliance readiness evidence.
```

---

## 2. Research Basis and Documentation Changes

### 2.1 Research basis

The v0.13 update is based on:

- The v0.10/v0.11 implementation-risk reviews, especially findings around PostgreSQL `LISTEN/NOTIFY`, event-boundary ambiguity, transactional-batch partitioning, formula workers, rate-limiter reconciliation, command recovery, security invariant enforcement, and compliance readiness.
- Cross-sectional review findings on TypeScript versus Rust/WASM, JavaScript/WASM bridge overhead, bulk-edit models, synchronization points, auditability, and replayability.
- Official PostgreSQL documentation for `LISTEN`, `NOTIFY`, row-level security, unlogged tables, and transactional notification behavior.
- Node.js documentation for `worker_threads`, transferables, and `SharedArrayBuffer`-based memory sharing.
- Current HTTP rate-limit header draft direction and the established HTTP `429 Too Many Requests` status.
- Browser and platform documentation for Server-Sent Events and SharedArrayBuffer constraints.
- Official TigerBeetle documentation for accounts, transfers, ledgers, two-phase transfers, system architecture, and Node.js integer handling.

### 2.2 Normative changes from v0.11

| Area | v0.11 position | v0.13 position |
|---|---|---|
| Live update wake-up | `LISTEN/NOTIFY` allowed if benchmarked, with polling fallback. | Polling-first outbox reader is Phase 0 default. `NOTIFY` is opt-in after P0 evidence. |
| Rate limiting | Tiered limiter, local buckets plus reconciliation. | No blocking PostgreSQL rate-limit writes on ordinary edit hot path. Cross-instance budget division is mandatory. |
| Transactional batch | Dependency validation required. | Implement partition graph compiler using connected components. No generic independence prover. |
| Command recovery | P0 gate exists. | Must be implemented first because every mutation endpoint depends on it. |
| Security invariants | Manifest required. | CI harness and invariant manifest are Phase 0 foundation work, not post-feature work. |
| Formula workers | Warm-up and corruption recovery specified. | Add resident graph benchmark, data-movement budget, and worker pool cold-start evidence. |
| ADRs | ADR-0014 and ADR-0015 required. | ADR-0015 is revised to `polling-first, NOTIFY-optional`. ADR-0009 and ADR-0004 get research addenda. |

### 2.3 Normative refinements from v0.12.1 to v0.12.2

| Area | v0.12.1 residual risk | v0.12.2 refinement |
|---|---|---|
| Pack completeness | External integration left placeholder and missing support docs. | Pack index, dev/ops/QA docs, review report, and validation are complete. |
| Trace context | UUID-only `trace_id` does not fit OpenTelemetry trace IDs cleanly. | `trace_id` is text/opaque trace context; UUID is only a local fallback. |
| Command privacy | Storing full command responses can retain personal or regulated data. | Store redacted outcomes or encrypted short-retention `response_ref`; raw requests are not retained by default. |
| Command concurrency | Duplicate in-flight submissions with the same command ID were under-specified. | First writer owns execution; matching duplicates return terminal outcome or `COMMAND_PENDING`. |
| SSE demand filtering | Late subscribers can miss events skipped by local demand filtering. | Every subscription starts from `initial_snapshot`, verified `resume_replay`, or `sync_required`. |

### 2.4 Normative refinements from v0.12.2 to v0.12.3

| Area | v0.12.2 residual risk | v0.12.3 refinement |
|---|---|---|
| Cognitive load | The pack is complete but large. | Add Day-1 onramp, minimal-scope overlay, and Week-1 ticket plan. |
| Architecture orientation | Flow diagrams existed, but no top-level system context. | Add architecture context and vertical-slice sequence diagrams. |
| Pilot evidence | Dataset and vertical-slice acceptance were implied. | Define `pilot-v1-small` dataset and acceptance checklist. |
| Command partitioning | Range partitioning tension was noted but not resolved. | Keep authoritative `command_log` unpartitioned or hash-partitioned by `tenant_id`; use current/archive split for retention. |
| Outbox implementation | Indexes existed, but table schema was implicit. | Add `outbox_events` DDL and recommend `RANGE (outbox_id)` only when partitioning is needed. |
| Batch feasibility | Union-Find was recommended but not illustrated. | Add TypeScript pseudo-code and a 10k-row compile budget. |
| Client behavior | Backend recovery was stronger than client-state guidance. | Add optimistic UI, conflict, ambiguity, and `SYNC_REQUIRED` rules. |
| Validation | Pack validator checked presence and key strings. | Add health score, YAML parse, Mermaid, version sync, required docs, and GitHub workflow. |


### 2.5 Normative refinements from v0.12.3 to v0.13

| Area | v0.12.3 residual risk | v0.13 refinement |
|---|---|---|
| Numeric ledger target | MVP had command/outbox safety but no explicit post-MVP numeric ledger plane. | TigerBeetle is the target numeric ledger plane after MVP. |
| Mutable balance risk | Financial and stock MVP implementation could still drift toward mutable balance rows. | Conserved numeric movement must go through append-only `numeric_transfers` via `NumericLedgerPort`. |
| Migration risk | Adopting TigerBeetle later could require domain command rewrites. | MVP derives deterministic future-compatible account and transfer IDs and isolates backing storage behind an adapter. |
| Source-of-truth boundary | `INV-001` treated PostgreSQL current-state tables broadly. | PostgreSQL remains the control plane; post-MVP TigerBeetle becomes authoritative for ledger-derived numeric balances. |
| Evidence gate | No explicit ledger-plane adoption gate. | Add P1-LEDGER-001, ledger benchmark plan, shadow-mode reconciliation, and transition plan. |
| Field assignment | TigerBeetle target model did not fix `ledger`, `code`, and `user_data_*` semantics. | Adopt hybrid model: dimension-centric accounts, movement/document-centric transfers, PostgreSQL semantic index catalog, and mirror indexes. |

---

### 2.10 Normative refinements from v0.13.2 to v0.14

| Area | v0.13.2 residual risk | v0.14 refinement |
|---|---|---|
| Command transaction boundary | The vertical slice was clear, but the exact mutation transaction sequence was too implicit. | `docs/dev/command-lifecycle.md` now defines the reservation transaction, business transaction, `NumericLedgerPort` placement, savepoint expectations, and partial-failure recovery. |
| Retrieval revalidation | `RetrievalRevalidator` was mandatory, but implementation shape and caching discipline were under-specified. | `docs/dev/retrieval-revalidator.md` now includes a middleware/service sketch, cache-key rules, TTL limits, and hot-path performance budget. |
| Observability adoption | Spans and metrics were listed, but implementers lacked concrete examples. | `docs/observability/phase0-observability.md` and `docs/observability/otel-reference.yml` now provide span and metric examples suitable for implementation review. |
| TigerBeetle shadow operations | Shadow and strict-shadow modes were defined but operationally abstract. | `docs/ops/tigerbeetle-shadow-mode-day-in-life.md` now defines daily checks, resource-watch items, reconciliation patterns, and alert thresholds. |
| Failure-mode recovery | The catalog listed failure modes but needed concrete recovery procedures. | `docs/ops/failure-mode-catalog.md` now includes recovery playbooks for outbox bloat/retention gaps, stalled outbox delivery, and ledger shadow mismatches. |


## 3. Updated Core Invariants

| ID | Invariant | Phase 0 implication |
|---|---|---|
| INV-001 | Current-state ERP tables remain the operational source of truth. | Event streams support audit, integration, recovery, and live updates; they do not replace normalized tables in MVP. |
| INV-002 | Every mutation has a durable command identity. | Implement `command_log` before editable cells. |
| INV-003 | Unknown command outcomes must be recoverable. | Lost HTTP responses never cause blind automatic retries. |
| INV-004 | Outbox polling is the default live-update wake-up path. | `LISTEN/NOTIFY` may be enabled only after benchmark evidence. |
| INV-005 | `NOTIFY` is never the durable event transport. | `outbox_events` is the durable source; notifications may only wake readers. |
| INV-006 | Ordinary edits must not write rate-limit counters synchronously to PostgreSQL. | Hot-path rate limiting uses edge and local token buckets. |
| INV-007 | `transactional_batch` commits dependency partitions, not arbitrary valid rows. | Hidden dependencies fail closed by partition. |
| INV-008 | No workbook may use `transactional_batch` without a validated partition policy. | Missing/invalid policy forces `atomic` or rejection. |
| INV-009 | Formula workers use resident graph state and delta messages. | Full workbook graph structured-cloning per edit is prohibited. |
| INV-010 | Security invariants are executable. | Every release-blocking invariant maps to CI evidence. |
| INV-011 | Compliance readiness is a pilot gate. | Regulated data cannot enter pilots without compliance evidence. |
| INV-012 | Client optimistic state must be recoverable and conflict-aware. | Pending edits cannot be rendered as saved until terminal command status or authoritative SSE reconciliation. |
| INV-013 | Conserved numeric movement must be ledger-shaped in MVP. | Financial, stock, credit, quota, and capacity movements use append-only debit/credit transfers through `NumericLedgerPort`; direct mutable balance updates are prohibited. |
| INV-014 | TigerBeetle is the target post-MVP numeric ledger plane. | MVP stores future-compatible account IDs, transfer IDs, ledger codes, transfer codes, and unsigned fixed-scale amounts so cutover is adapter-scoped. |
| INV-015 | TigerBeetle field assignment is versioned and mirrored in PostgreSQL. | `ledger`, `code`, and `user_data_*` semantics use `docs/data/tigerbeetle-field-assignment-policy.md`; PostgreSQL stores mirror fields and semantic indexes. |

---

## 4. Phase 0 Execution Order

### 4.1 P0 workstreams

| Order | Workstream | Why it comes here | Primary evidence |
|---:|---|---|---|
| 1 | **Command identity and status** | All mutations depend on idempotency and unknown-outcome recovery. | `TC-CMD-001`, command status API tests, command TTL tests. |
| 2 | **Outbox polling live-update path** | Live updates must not depend on `NOTIFY`; polling proves durable delivery. | Polling replay tests, outbox high-watermark tests, SSE refresh tests. |
| 3 | **Security invariant CI harness** | Security cannot be retrofitted after command/query code exists. | `security-invariants.yml`, CI manifest, RLS and query compiler tests. |
| 4 | **Transactional-batch partition compiler** | Batch semantics shape UX, audit, API, and domain model. | Partition policy validation, fuzz tests, fixtures. |
| 5 | **Hot-path rate limiter** | Protects edit endpoints without overloading PostgreSQL. | Local bucket tests, instance budget tests, 429/RateLimit header tests. |

### 4.2 P1 workstreams that should start in parallel as spikes

| Workstream | Scope | Exit criterion |
|---|---|---|
| Formula worker resident graph | Worker pool, graph warm-up, delta message protocol, cold-start tests. | Warm edit recalc meets latency budget; cold-start fallback displays stale-safe state. |
| Rust/WASM benchmark governance | Benchmark harness and rejection template only; no Rust implementation by default. | Benchmark can measure end-to-end bridge/transfer cost. |
| Compliance readiness | DPA, residency matrix, retention policy, legal hold workflow, malware scan policy. | Compliance owner can sign or block pilot. |
| Grid dependency DAR | Select grid candidate using benchmark and security review. | One approved grid dependency or custom-grid ADR. |
| Numeric ledger plane | PostgreSQL MVP numeric ledger adapter, deterministic IDs, TigerBeetle target model, shadow-mode spike. | P1-LEDGER-001 decides finance-only, finance+stock, selected ledgers, or defer. |

---

## 5. Live Update Strategy: Polling-First Outbox Reader

### 5.1 Decision

Phase 0 uses **polling-first durable outbox delivery**.

```text
Command transaction
  -> current-state update
  -> audit_events insert
  -> domain_events insert
  -> outbox_events insert
  -> commit

Outbox reader loop
  -> poll outbox_events by high watermark
  -> filter by local SSE subscribers
  -> push event envelopes
  -> update local high watermark
```

`LISTEN/NOTIFY` is optional. It may be enabled only as a wake-up optimization after P0-LIVE-001 evidence shows no unacceptable commit-latency impact under target workload and PostgreSQL distribution.

### 5.2 Rationale

PostgreSQL documentation states that notifications are delivered to listening sessions after the notifying transaction commits, and that a transaction calling `NOTIFY` can fail at commit if the notification queue is full. The documentation also recommends placing large data in a table and sending only the key through the notification payload. Because our architecture already has `outbox_events`, the notification is unnecessary for durability and should not be allowed to endanger commit latency.

Independent production incident reporting has also shown that `LISTEN/NOTIFY` can become a commit-path bottleneck under high write concurrency. The Phase 0 posture is therefore conservative: prove polling first, then admit `NOTIFY` only if benchmarked safe.

### 5.3 Polling reader contract

| Requirement | Phase 0 value |
|---|---:|
| Default mode | `polling` |
| Optional modes | `notify`, `auto_polling`, future `coordinator` |
| Poll interval | 2s in dev/test; 5s +/- jitter in pilot |
| Poll jitter | 10%-30% of interval |
| Replay source | `outbox_events WHERE outbox_id > local_high_watermark` |
| Replay ordering | `ORDER BY outbox_id ASC` |
| Event payload fetch | Only for tenants/workbooks with local subscribers |
| Max events per poll | 500 envelopes, configurable |
| Max bytes per poll | 2 MiB, configurable |
| Gap handling | `outbox_id` is monotonic but not gapless; gaps are normal. |
| Full refresh trigger | Event count, byte budget, retention gap, or schema mismatch. |

### 5.4 Demand-filtered polling

Each application instance maintains a local subscription index:

```ts
type LocalSubscriptionIndex = {
  tenants: Set<TenantId>;
  workbookIdsByTenant: Map<TenantId, Set<WorkbookId>>;
  connectionsByWorkbook: Map<WorkbookId, Set<SseConnectionId>>;
};
```

The outbox reader must avoid fetching large payloads when the instance has no local subscribers for the event's tenant/workbook.

Recommended query pattern:

```sql
SELECT outbox_id, tenant_id, workbook_id, event_type, payload_size_bytes, created_at
FROM outbox_events
WHERE outbox_id > $1
  AND tenant_id = ANY($2::uuid[])
ORDER BY outbox_id ASC
LIMIT $3;
```

Then fetch payloads only for locally subscribed workbooks.

### 5.5 Outbox storage, indexing, and retention

The authoritative DDL, indexes, partitioning, retention, and vacuum rules for `outbox_events` live only in `docs/data/command-outbox-retention-partitioning.md`. Other documents must not duplicate `CREATE TABLE outbox_events`.

Normative summary:

- `outbox_events` is the durable replay source for live updates.
- Replay uses `outbox_id` high-watermark ordering; `outbox_id` is monotonic but not gapless.
- Demand-filtered readers may skip payload fetches when no local subscriber exists, but late subscribers must use the SSE subscription handshake below.
- Partitioning, if needed, uses `RANGE (outbox_id)` after benchmark and SRE approval.
- Retention gaps force full refresh rather than partial replay.

See: `repo://docs/data/command-outbox-retention-partitioning.md#outbox-events-recommendation`.

### 5.6 SSE subscription handshake

A new SSE subscriber must not assume that the instance-local high watermark proves the client has seen prior events. The subscription handshake is:

```text
1. Client opens SSE with tenant/workbook scope and optional client watermark.
2. Server registers the local subscription before promising live delivery.
3. Server either sends a snapshot at a known server watermark or replays from the accepted client watermark.
4. If the client watermark is behind retention, ahead of the server, or has a schema mismatch, server returns SYNC_REQUIRED and the client performs full workbook refresh.
5. Only after snapshot or replay completes may the connection be marked live.
```

This rule prevents demand-filtered polling from skipping payloads needed by late subscribers. Evidence: `ci://tests/live-update/sse-subscription-handshake` and `ci://tests/live-update/outbox-retention-gap-refresh`.

### 5.7 Optional `NOTIFY` admission gate

`NOTIFY` may be enabled only if:

```text
p95(commit_with_notify - commit_without_notify) <= 50 ms
AND no sustained lock wait amplification is observed
AND notification queue usage remains below alert threshold
AND polling fallback test passes
```

If enabled, `NOTIFY` payloads must contain only a small key or high-watermark hint, never full event payloads.


---

## 6. Command Identity and Unknown-Outcome Recovery

### 6.1 Implement this first

The command layer is the first Phase 0 implementation target. Do not build editable cells, bulk paste, imports, exports, or workflow actions before command idempotency and command-status recovery are working.

### 6.2 Command log schema

The authoritative `command_log` DDL, indexes, retention, privacy-safe response storage, and partitioning recommendation live only in `docs/data/command-outbox-retention-partitioning.md`. Other documents must not duplicate `CREATE TABLE command_log`.

Normative summary:

- `PRIMARY KEY (tenant_id, command_id)` is the idempotency boundary.
- `trace_id`, `correlation_id`, `request_hash`, and `request_body_hash` are required.
- Raw request bodies are not retained by default.
- Exact replay uses either redacted response body or encrypted short-retention `response_ref`.
- Phase 0 starts unpartitioned; the first scale path is `HASH (tenant_id)`, not `RANGE (created_at)`, unless a separate idempotency registry is approved.

See: `repo://docs/data/command-outbox-retention-partitioning.md#command-log-schema`.

### 6.3 Idempotency rule

```text
Same tenant_id + same commandId + same request_hash
  -> return original response.

Same tenant_id + same commandId + different request_hash
  -> reject with COMMAND_ID_REUSE_CONFLICT.

Same tenant_id + same commandId + same request_hash while first execution is still in-flight
  -> return COMMAND_PENDING/202 with Retry-After; do not execute a second mutation.

Unknown or expired commandId after network failure
  -> require workbook refresh and explicit user confirmation before retry.
```

### 6.4 Client UX rule

If the client loses the HTTP response after submitting a command:

```text
1. Poll GET /api/v1/commands/{commandId}.
2. If committed/rejected/failed is returned, render the original outcome.
3. If status remains received beyond timeout, display pending state.
4. If status is expired/not found, display ambiguity:
   "This edit may have succeeded. Refresh the workbook before retrying."
5. Never auto-retry with a new commandId.
```

### 6.5 Command status API and ambiguity rule

The command status API is specified in `docs/api/command-status.openapi.yml` and summarized in `docs/api/command-status-openapi.md`. All responses must include `trace_id` and `correlation_id` where a command record exists. Terminal responses return `response_body_redacted` or an authorized encrypted `response_ref`, never raw retained request bodies. `COMMAND_PENDING` is returned for matching duplicate in-flight submissions. The `ambiguous` status is set only by the TTL cleanup job when `expires_at` has passed and no matching audit, domain, or outbox record exists for that `command_id`.
### 6.6 Duplicate in-flight command behavior

If a second request arrives with the same `tenant_id`, `command_id`, and `request_hash` while the first request is still executing, the API must not execute the mutation a second time. The first writer owns execution. Later matching requests return either the terminal stored outcome or `202 COMMAND_PENDING` with `Retry-After`, then the client polls `GET /api/v1/commands/{commandId}`.

`COMMAND_PENDING` is not an error state. It is the safe duplicate-in-flight response that preserves idempotency while avoiding blind retry behavior.

### 6.7 Client optimistic UI and conflict behavior

The client may render an optimistic cell value only as `local_pending`. It must not render the edit as saved until command status is terminal or an authoritative SSE/snapshot reconciliation confirms the value/version.

Minimum client states:

| State | Required behavior |
|---|---|
| `local_pending` | Show pending indicator; keep command ID and expected cell version. |
| `server_committed` | Reconcile with server value/version and clear pending state. |
| `server_rejected` | Restore latest server value and show cell-level error. |
| `command_pending` | Continue polling command status; do not submit a replacement command ID. |
| `ambiguous` | Require refresh before user-initiated retry. |
| `sync_required` | Full workbook refresh before further edits. |

If an SSE event with a newer server version arrives while a local command is pending, the UI must keep the conflict visible until the pending command resolves. It must not silently overwrite or silently accept stale optimistic state. Detailed guidance is in `docs/dev/client-optimistic-ui-and-conflicts.md`.


---

## 7. Transactional Batch Partitioning

### 7.1 Decision

Do **not** build a general-purpose independence prover.

`transactional_batch` is permitted only for workbook/domain operations with a declared and validated `BatchPartitionPolicy`. The compiler builds dependency partitions as connected components. Each component either commits or fails as a unit.

### 7.2 Partition policy schema

```yaml
version: "0.13.2"
workbookKey: "inventory_control"
sourceObject: "Product"
mode: "transactional_batch"
defaultFallback: "atomic_or_reject"
partitionKeys:
  - "tenant_id"
  - "product_id"

dependencyEdges:
  - kind: "foreign_key"
    fromObject: "Sku"
    fromField: "product_id"
    toObject: "Product"
    toField: "id"
  - kind: "formula_reference"
    formulaColumn: "Available"
    references:
      - "StockBalance.OnHand"
      - "StockReservation.Reserved"
  - kind: "aggregate_dependency"
    aggregate: "InventoryValueByProduct"
    references:
      - "StockBalance.quantity_on_hand"
      - "Product.standard_cost"

customDomainRules:
  - id: "inventory-adjustments-share-product-warehouse"
    description: "Rows sharing product_id + warehouse_id are one partition."
    positiveFixture: "repo://tests/fixtures/batch/inventory/positive.json"
    negativeFixture: "repo://tests/fixtures/batch/inventory/negative.json"
```

### 7.3 Partition compiler algorithm

```text
1. Parse all candidate row edits.
2. Resolve source objects and record IDs.
3. Add one graph vertex per row mutation.
4. Add edges for:
   - same declared partition key,
   - SQL foreign-key relationship,
   - formula dependency relationship,
   - aggregate/pivot source dependency,
   - custom domain rule result.
5. Compute connected components.
6. Validate each component independently.
7. Commit each valid component in a database transaction.
8. Fail invalid components with exact row/column error coordinates.
9. Emit batch record, command outcome, audit/domain events, and outbox events.
```

Implementation note: use Union-Find or an equivalent O(V + E) connected-components implementation. The connected-component compile phase target is <= 200 ms for the 10k-row pilot fixture; full validation target remains `batch_10k_validation_ms` in `docs/slo-baseline.yml`. Validation timeout must fail the affected partition closed.

```ts
const uf = new UnionFind(edits.length);
for (const edge of derivePolicyEdges(edits, policy, indexes)) {
  uf.union(edge.fromEditIndex, edge.toEditIndex);
}
const partitions = groupByRoot(edits, i => uf.find(i));
```

Do not introduce a heavy graph library for Phase 0 unless Union-Find cannot express a declared policy requirement. Additional pseudo-code is in `docs/dev/batch-partition-policy.md`.

### 7.4 Failure contract

| Case | Behavior |
|---|---|
| Missing policy | Reject `transactional_batch` or reroute to `atomic` if domain permits. |
| Policy references unknown table/field | CI failure and runtime rejection. |
| Formula AST references undeclared dependency | CI failure. |
| Custom rule lacks fixtures | CI failure. |
| Partition validation timeout | Fail the affected partition closed. |
| Financial posting | `transactional_batch` prohibited unless approved by Finance Owner and Security Owner. |

---

## 8. Hot-Path Rate Limiting Without PostgreSQL Contention

### 8.1 Decision

Ordinary low-risk edit commands must not synchronously increment PostgreSQL rate-limit counters before executing the business transaction.

### 8.2 Tiered limiter

```text
Layer 1: Edge limiter
  - coarse IP/session/origin controls
  - WAF or load-balancer limits where available

Layer 2: Per-instance in-memory token buckets
  - hot-path limiter for ordinary cell edits
  - dimensions: tenant_id, user_id, workbook_id, command_type, risk_class

Layer 3: Cross-instance budget division
  - each instance derives local budget from active instance heartbeat count
  - conservative headroom prevents N x tenant limit overrun

Layer 4: Coarse PostgreSQL ceiling
  - minute-level tenant/risk counters
  - high-risk commands only on request path
  - low-risk observations flushed asynchronously
```

### 8.3 Active instance heartbeat

The authoritative heartbeat DDL lives in `docs/data/command-outbox-retention-partitioning.md#operational-support-tables`. The rate-limiter docs may describe behavior but must not duplicate the schema.

An instance is active if:

```text
now() - last_seen_at <= 3 * heartbeat_interval
```

Local tenant budget:

```text
local_budget = floor(global_tenant_budget / (active_instance_count + 1))
```

The `+1` headroom is intentional. It reduces the risk that stale heartbeats or sudden autoscaling briefly multiply the tenant budget.

Heartbeat cleanup runs on a scheduled single-writer job or under an advisory lock:

```sql
DELETE FROM app_instance_heartbeats
WHERE last_seen_at < now() - INTERVAL '10 minutes';
```

Active instance count is eventually consistent. Budget division must remain conservative when heartbeat data is missing or stale.

### 8.4 PostgreSQL counter policy

PostgreSQL counters may be used only for coarse ceilings. The authoritative counter-table DDL lives in `docs/data/command-outbox-retention-partitioning.md#operational-support-tables`.

Unlogged tables may be used only for transient, non-authoritative counters where crash reset is acceptable. They must not be treated as audit, billing, security evidence, or compliance records.

### 8.5 Client response headers

For throttled API calls:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 8
RateLimit: "edit";r=0;t=8
RateLimit-Policy: "edit";q=120;w=60
Content-Type: application/problem+json
```

If compatibility with older clients is needed, the API may additionally emit `X-RateLimit-*` headers. The canonical v0.13 documentation uses the current HTTPAPI `RateLimit` and `RateLimit-Policy` work-in-progress fields plus `Retry-After`; implementation must track draft changes before production freeze.

---

## 9. Security Invariant Manifest and CI Harness

### 9.1 Build this before feature expansion

The invariant harness must exist before permission-sensitive features are implemented. This prevents the security model from becoming a prose-only standard.

### 9.2 Manifest format

```yaml
version: "0.13.2"
invariants:
  - id: "AC-001"
    title: "Tenant isolation on operational reads"
    category: "access_control"
    severity: "release_blocker"
    checkType: "integration_test"
    evidenceUri: "ci://tests/security/tenant-isolation-read"
    owner: "Security Owner"
    appliesTo: ["api", "query_compiler", "rls"]

  - id: "LIVE-001"
    title: "Live updates are delivered from durable outbox events"
    category: "live_update"
    severity: "release_blocker"
    checkType: "integration_test"
    evidenceUri: "ci://tests/live-update/outbox-polling-replay"
    owner: "Platform/SRE Owner"
    appliesTo: ["outbox_events", "sse", "polling_reader"]
```

### 9.3 Severity model

| Severity | Meaning | Enforcement |
|---|---|---|
| `release_blocker` | Security/correctness property required before release. | Every PR or pre-release CI. |
| `page` | Production invariant that requires urgent response. | Staging + production monitor. |
| `ticket` | Operational quality condition. | Monitor and triage. |

---

## 10. Formula Worker Execution Plan

### 10.1 Decision

Formula evaluation remains TypeScript-first in Phase 0, using Node.js worker threads for CPU-intensive evaluation. The worker must maintain resident graph state and accept small delta commands. Full workbook graph cloning per edit is prohibited.

### 10.2 Worker graph state machine

```text
cold
  -> warming
  -> ready
  -> stale
  -> rebuilding
  -> ready
  -> corrupt
  -> rebuilding or disabled
```

### 10.3 Worker data movement rules

| Rule | Requirement |
|---|---|
| No full graph clone per edit | Worker receives workbook graph once during warm-up or rebuild. |
| Delta commands | Normal edit messages include only node ID, version, and changed scalar values. |
| Tokenized AST | Formula AST is stored as numeric/token arenas, not nested object graphs, where feasible. |
| Transferables | Use transferable `ArrayBuffer` for large immutable snapshots where helpful. |
| SharedArrayBuffer | Evaluate only if p95 delta payload exceeds 10 KiB or transfer cost dominates computation. |
| Corruption detection | Unknown node/version mismatch triggers controlled graph rebuild, not crash. |

### 10.4 Rust/WASM gate

Rust/WASM remains a measured upgrade path, not an MVP default. A proposal must beat the optimized TypeScript resident-worker model end-to-end after data transfer, serialization, worker/process overhead, and observability costs are included.

---

## 11. Benchmark Plan

### 11.1 Required benchmarks before Phase 0 pilot

| ID | Benchmark | Release effect |
|---|---|---|
| `BENCH-CMD-001` | Single edit command with command log, audit, domain event, outbox insert. | Blocks if p95 exceeds target by >25%. |
| `BENCH-LIVE-001` | Outbox polling replay with 1k/10k events and active SSE subscribers. | Blocks if replay gaps or duplicate delivery occur. |
| `BENCH-NOTIFY-001` | Commit latency with and without `NOTIFY` under concurrent writers. | Enables or disables `NOTIFY`. |
| `BENCH-RATE-001` | Local token bucket hot path under 100 concurrent users. | Blocks if limiter adds >5 ms p95 to ordinary edits. |
| `BENCH-BATCH-001` | Partition validation with 100/1k/10k row paste. | Blocks if incorrect partition commits. |
| `BENCH-FORM-001` | Worker warm-up, warm delta recalc, cold rebuild. | Determines formula-worker rollout scope. |
| `BENCH-LEDGER-001` | PostgreSQL MVP numeric ledger adapter with 1k/10k financial and stock transfers. | Blocks MVP ledger-shaped adoption if duplicate transfer IDs, projection mismatch, or direct balance writes occur. |
| `BENCH-LEDGER-002` | TigerBeetle shadow adapter against the same movement plan. | Determines post-MVP TigerBeetle adoption path. |
| `BENCH-RLS-001` | Permission query plans at 10th/50th/90th percentile user-scope cardinality. | Blocks if sequential scans violate budget. |

### 11.2 Execution rules

```text
- Use a versioned pilot-like dataset.
- Run each benchmark five times and report median plus p95/p99.
- Save raw logs, machine type, PostgreSQL version, Node.js version, OS, dataset version, and git SHA.
- Any p95 regression > 15% requires investigation.
- Any p95 regression > 25% blocks release unless waived by Engineering + SRE + Security owners.
```

### 11.3 Quantified baseline

`docs/slo-baseline.yml` is normative for Phase 0 targets. Gate cards and benchmark reports must reference the applicable SLO entry. Placeholder SLO files are invalid and block pack validation.

Key targets:

| Target | Value |
|---|---:|
| Single edit command p95 | 180 ms |
| Command duplicate pending response p95 | 50 ms |
| Command ambiguous rate | <= 0.1% |
| Polling lag p99 | 8 s |
| Rate limiter overhead p95 | 5 ms |
| 10k batch partition validation | 400 ms |
| Formula warm delta p95 | 30 ms |
| NOTIFY commit delta p95 admission | 50 ms |

### 11.4 Observability baseline

`docs/observability/phase0-observability.md` defines required spans, metrics, labels, and alerts. Phase 0 release is blocked if command, outbox, and SSE paths cannot be joined by `trace_id` and `correlation_id`.

---

## 12. Updated Gate Cards

### 12.1 P0-CMD-001: Command identity and unknown-outcome recovery

**Owner:** API/Client Owner  
**Waiver:** Not allowed  
**Implementation order:** First

**Requirements:**

- Implement `command_log` and command status endpoint before editable cells.
- Persist idempotency outcome for at least 24 hours; pilot target is 7 days.
- Same `commandId` + same request hash returns the original outcome or `COMMAND_PENDING` while first execution is in flight.
- Same `commandId` + different request hash returns `COMMAND_ID_REUSE_CONFLICT`.
- Raw request bodies are not stored by default; command responses are redacted or encrypted by reference.
- Client never auto-retries a new `commandId` after an ambiguous outcome.

**Evidence:**

```text
ci://tests/e2e/TC-CMD-001-network-loss-after-commit
ci://tests/api/command-status-ttl
ci://tests/api/command-id-reuse-conflict
```

### 12.2 P0-LIVE-001: Polling-first live-update safety

**Owner:** Platform/SRE Owner  
**Waiver:** Not allowed

**Requirements:**

- Implement durable outbox polling before enabling `NOTIFY`.
- Prove replay by high-watermark, SSE initial snapshot/resume, and full-refresh fallback.
- `NOTIFY` may not be enabled unless commit-latency benchmark passes.
- `NOTIFY` payloads contain keys/high-watermarks only.

**Evidence:**

```text
ci://tests/live-update/outbox-polling-replay
ci://tests/live-update/full-refresh-fallback
ci://benchmarks/BENCH-NOTIFY-001
```

### 12.3 P0-INV-001: Security invariant manifest

**Owner:** Security Owner  
**Waiver:** Emergency waiver only by CTO + Security Owner

**Requirements:**

- `invariants/security-invariants.yml` exists before permission-sensitive feature PRs merge.
- All `release_blocker` checks run in CI.
- PRs touching access control, RLS, formulas, import/export, outbox/audit writes, or query compilation update relevant invariant checks.

### 12.4 P0-BATCH-001: Transactional-batch partition validation

**Owner:** Backend/Domain Model Owner  
**Waiver:** Not allowed for `transactional_batch`

**Requirements:**

- No workbook enables `transactional_batch` without a policy.
- Partition policies compile into graph components.
- Hidden FK/formula/aggregate/custom dependencies fail closed.
- Fuzz tests prove no cross-partition invariant violation commits.

### 12.5 P0-RATE-001: Hot-path rate-limit safety

**Owner:** Platform/API Owner  
**Waiver:** Not allowed for ordinary edit endpoints

**Requirements:**

- Ordinary edit commands do not synchronously write PostgreSQL rate-limit counters.
- Per-instance local budgets divide global tenant budget by active instances plus headroom.
- High-risk commands have coarse PostgreSQL ceiling checks.
- 429 responses include `Retry-After`, `RateLimit`, and `RateLimit-Policy`.

### 12.6 P1-FORM-001: Formula worker resident-graph benchmark

**Owner:** Formula Owner  
**Waiver:** Allowed for non-decision-critical formula rollout only

**Requirements:**

- Worker warm-up is measured.
- Warm delta recalc is measured.
- Cold rebuild fallback displays stale-safe state.
- Graph corruption triggers rebuild.
- Rust/WASM comparison includes bridge/data-transfer cost.

### 12.7 P1-LEDGER-001: TigerBeetle numeric ledger plane spike

**Owner:** Domain Ledger Owner + Platform/SRE Owner  
**Waiver:** Allowed for MVP runtime dependency only. MVP ledger-shaped contract is not waivable.

**Requirements:**

- Conserved numeric movement uses `NumericLedgerPort` in MVP.
- MVP stores deterministic future-compatible account IDs and transfer IDs.
- Financial and stock movements are modeled as append-only debit/credit transfers.
- Balance projections rebuild from `numeric_transfers`.
- TigerBeetle adapter prototype can replay or shadow the same movement plan.
- Unknown-outcome recovery can lookup expected transfer IDs.
- Outbox/audit correlation remains PostgreSQL-owned and command-correlated.

**Evidence:**

```text
ci://tests/ledger/deterministic-transfer-id
ci://tests/ledger/projection-rebuild-from-transfers
ci://tests/ledger/financial-balanced-posting-flow
ci://tests/ledger/stock-available-reserved-shipped-flow
ci://tests/ledger/ambiguous-command-lookup-by-transfer-id
ci://benchmarks/BENCH-LEDGER-001-postgres-mvp-adapter
ci://benchmarks/BENCH-LEDGER-002-tigerbeetle-shadow-adapter
```

---

## 13. Required ADR Updates

| ADR | Status | v0.13 action |
|---|---|---|
| ADR-0004 Formula Worker Isolation | Existing | Add resident graph, delta messages, worker warm-up, and Rust/WASM benchmark governance. |
| ADR-0009 Tiered Rate Limiting | Existing | Replace PostgreSQL-hot-path counters with edge/local/token-bucket/coarse-ceiling model. |
| ADR-0014 Event-Ready Boundary | Existing | Retain; clarify `domain_events` as canonical business event stream and `outbox_events` as delivery projection. |
| ADR-0015 Live Update Wake-Up | Revise | Change to polling-first, `NOTIFY`-optional after benchmark gate. |
| ADR-0016 Phase 0 Execution Order | New | Lock order: command -> outbox polling -> invariant harness -> batch partition -> hot-path limiter. |
| ADR-0017 Command Log Privacy and Trace Context | New | Store OTEL-compatible trace IDs, redacted outcomes, and encrypted short-retention response references. |
| ADR-0018 Pack Governance and Drift Control | New | Keep one canonical pack root and require validation before pack changes merge. |
| ADR-0019 TigerBeetle as Target Numeric Ledger Plane | New | Make TigerBeetle the post-MVP target for conserved numeric movement while keeping MVP PostgreSQL-backed and ledger-shaped. |
| ADR-0020 TigerBeetle Field Assignment Policy | New | Select hybrid field assignment and reject ledger-heavy, entity-centric, packed-bitfield, and command-centric defaults. |

---

## 14. Required Developer Documentation

Create these before broad Phase 0 implementation:

```text
docs/dev/command-lifecycle.md
docs/dev/outbox-polling-reader.md
docs/dev/security-invariant-manifest.md
docs/dev/batch-partition-policy.md
docs/dev/rate-limiter.md
docs/dev/formula-worker-protocol.md
docs/dev/numeric-ledger-plane.md
docs/data/numeric-ledger-contract.md
docs/data/tigerbeetle-target-model.md
docs/plan/post-mvp-tigerbeetle-transition.md
docs/ops/outbox-wakeup-runbook.md
docs/ops/unknown-command-outcome-runbook.md
docs/qa/phase0-benchmark-plan.md
docs/onboarding/engineer-onramp-day1.md
docs/plan/week1-vertical-slice-kickoff.md
docs/data/pilot-dataset-definition.md
docs/data/command-outbox-retention-partitioning.md
docs/dev/client-optimistic-ui-and-conflicts.md
docs/diagrams/architecture-context.md
```

Each document must include:

```text
- Purpose
- Normative behavior
- API/schema examples
- Failure modes
- Required tests
- Observability fields
- Owner role
- Links to ADRs and gate cards
```

---

## 15. Updated Phase 0 Definition of Done

Phase 0 is complete only when:

```text
1. Single edit command persists command_log, current-state change, audit_event, domain_event, and outbox_event.
2. Unknown-outcome recovery passes TC-CMD-001.
3. Outbox polling delivers live updates without NOTIFY, including SSE initial snapshot/resume/full-refresh paths.
4. NOTIFY benchmark either passes and is admitted, or remains disabled.
5. Security invariant manifest runs in CI.
6. Transactional-batch policy compiler fails closed on hidden dependencies.
7. Hot-path edit rate limiting does not write PostgreSQL counters synchronously.
8. Formula worker spike demonstrates resident graph and delta protocol, or formula rollout is scoped down.
9. ADR-0004, ADR-0009, ADR-0014, ADR-0015, ADR-0016, ADR-0017, and ADR-0018 are signed.
10. Compliance owner signs Phase 0 readiness or blocks regulated pilot data.
11. All referenced developer, operator, QA, ADR, and benchmark docs exist as non-placeholder files.
12. The mandatory vertical slice passes in the pilot dataset with command -> outbox polling -> SSE -> recovery evidence.
13. `pilot-v1-small` acceptance evidence is attached for the vertical slice.
14. Command/outbox schema and partitioning choices match `docs/data/command-outbox-retention-partitioning.md`.
15. Client pending, conflict, ambiguity, and `SYNC_REQUIRED` states are tested.
```

---

## 16. Source References

Primary references and research basis:

- PostgreSQL `NOTIFY`: https://www.postgresql.org/docs/current/sql-notify.html
- PostgreSQL `LISTEN`: https://www.postgresql.org/docs/current/sql-listen.html
- PostgreSQL row-level security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL unlogged tables: https://www.postgresql.org/docs/current/sql-createtable.html
- Node.js `worker_threads`: https://nodejs.org/api/worker_threads.html
- MDN EventSource and Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- MDN SharedArrayBuffer: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer
- IETF HTTPAPI RateLimit draft-11: https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
- RFC 6585, HTTP 429: https://www.rfc-editor.org/info/rfc6585/
- Recall.ai PostgreSQL LISTEN/NOTIFY incident analysis: https://www.recall.ai/blog/postgres-listen-notify-does-not-scale
- TigerBeetle system architecture: https://docs.tigerbeetle.com/coding/system-architecture/
- TigerBeetle data modeling: https://docs.tigerbeetle.com/coding/data-modeling/
- TigerBeetle transfer reference: https://docs.tigerbeetle.com/reference/transfer/
- TigerBeetle account reference: https://docs.tigerbeetle.com/reference/account/
- TigerBeetle two-phase transfers: https://docs.tigerbeetle.com/coding/two-phase-transfers/
- TigerBeetle Node.js client notes: https://docs.tigerbeetle.com/coding/clients/node/

---

## 17. Final v0.13 Recommendation

Proceed with Phase 0 only after converting the highest-priority risks into executable evidence.

The safest practical approach is:

```text
Start with command correctness and durable outbox polling.
Keep live updates slightly delayed but reliable.
Keep rate limiting off the PostgreSQL edit hot path.
Keep transactional_batch narrow and policy-validated.
Keep formula workers resident and delta-oriented.
Keep Rust/WASM, NOTIFY, and broader batching as evidence-gated optimizations.
```

The highest immediate risk is still the transactional-batch partition engine, because it affects domain modeling, UX, audit, API semantics, and correctness. The fastest immediate win remains command identity + outbox polling, because it gives the team a safe vertical slice and de-risks every later mutation path. v0.13 adds the onboarding, kickoff, dataset, schema, client, validation, and numeric ledger plane artifacts needed to start that slice while keeping the post-MVP TigerBeetle transition feasible.


---

## 18. v0.13 Pack Governance and Kickoff Addendum

### 18.1 Non-placeholder requirement

Any file listed in `docs/pack-index.md`, `tests/manifest.yml`, a gate card, or this spec must exist and contain actionable content. Placeholder text such as stub-only language is invalid.

### 18.2 Required artifacts added through v0.13

```text
docs/pack-index.md
docs/slo-baseline.yml
docs/diagrams/phase0-flows.md
docs/adr/ADR-0014-event-ready-boundary.md
docs/dev/command-lifecycle.md
docs/dev/outbox-polling-reader.md
docs/dev/security-invariant-manifest.md
docs/dev/batch-partition-policy.md
docs/dev/rate-limiter.md
docs/dev/formula-worker-protocol.md
docs/dev/numeric-ledger-plane.md
docs/data/numeric-ledger-contract.md
docs/data/tigerbeetle-target-model.md
docs/plan/post-mvp-tigerbeetle-transition.md
docs/ops/outbox-wakeup-runbook.md
docs/ops/unknown-command-outcome-runbook.md
docs/qa/phase0-benchmark-plan.md
docs/api/command-status-openapi.md
docs/api/command-status.openapi.yml
docs/observability/phase0-observability.md
docs/compliance/eu-dpa-dsr-matrix.md
docs/risk-register.md
docs/pr-checklist.md
docs/maintenance/pack-maintenance.md
docs/security/command-log-privacy.md
docs/adr/ADR-0017-command-log-privacy-and-trace-context.md
scripts/validate-pack.sh
docs/onboarding/engineer-onramp-day1.md
docs/plan/week1-vertical-slice-kickoff.md
docs/data/pilot-dataset-definition.md
docs/data/command-outbox-retention-partitioning.md
docs/dev/client-optimistic-ui-and-conflicts.md
docs/diagrams/architecture-context.md
docs/process/decision-waiver-log.md
docs/review/critical-review-v0.13.md
.github/workflows/validate-pack.yml
```

### 18.3 Review cadence

During Phase 0, review this pack weekly and immediately after any benchmark regression, gate waiver, compliance decision, or incident. Every externally shared baseline must have a version bump and a pack validation run.


---

## Appendix C. v0.13 Privacy, Drift, and Kickoff Refinements

- `trace_id` is text and must support W3C Trace Context / OpenTelemetry identifiers.
- `command_log` stores raw request/response hashes and redacted outcomes by default, not raw request bodies.
- Exact response replay that contains sensitive data uses encrypted, short-retention `response_ref`.
- `docs/data/command-outbox-retention-partitioning.md` governs command/outbox retention and partitioning.

- v0.13 adds a Day-1 onramp, architecture context diagram, Week-1 vertical-slice plan, pilot dataset contract, explicit outbox schema, client conflict guidance, and CI validation workflow.


---

## 19. v0.13 Kickoff and Schema Addendum

### 19.1 Day-1 onboarding overlay

The pack now includes a mandatory lightweight onboarding path in `docs/onboarding/engineer-onramp-day1.md`. New engineers should not begin by reading every file. They should read the pack index, architecture context, first gate card, SLO baseline, pilot dataset definition, and Week-1 ticket plan.

### 19.2 Minimal vertical-slice scope

The first implementation milestone is one safe editable inventory cell using `pilot-v1-small`. Broad grid polish, imports, exports, formula breadth, workflow actions, and transactional-batch UX are blocked until the vertical-slice checklist passes.

Required acceptance evidence lives in `docs/plan/vertical-slice-acceptance-checklist.md`.

### 19.3 Pilot dataset

Phase 0 evidence must name the dataset used:

| Dataset | Required use |
|---|---|
| `pilot-v1-small` | Vertical slice, command recovery, SSE handshake, privacy tests. |
| `pilot-v1-10k` | Batch partition and polling scale tests. |
| `pilot-v1-cardinality` | RLS/query-plan tests. |

### 19.4 Command-log partitioning resolution

`command_log` must preserve `PRIMARY KEY (tenant_id, command_id)`. The Phase 0 recommendation is a single table. The first scale path is hash partitioning by `tenant_id`, because the partition key is included in the idempotency key. Do not range-partition command idempotency by `created_at` unless a separate registry table preserves `(tenant_id, command_id)` uniqueness.

### 19.5 Outbox schema and partitioning

`outbox_events` is explicitly defined in `docs/data/command-outbox-retention-partitioning.md`. Phase 0 uses a single table with covering indexes. The first scale path is range partitioning by `outbox_id`, not `created_at`, because `outbox_id` is the replay key and partition key.

### 19.6 Batch compiler implementation note

The partition compiler should use a TypeScript Union-Find implementation for connected components. The target is effectively linear time over vertices and dependency edges. `graphology` or similar libraries may be used for diagnostics/tests, but production hot-path usage requires benchmark evidence.

### 19.7 Client optimistic state and conflicts

The client may display optimistic pending state only if it remains visibly pending and reconciles from command status plus SSE. Ambiguous outcomes and retention gaps require refresh before retry. Client guidance lives in `docs/dev/client-optimistic-ui-and-conflicts.md`.

### 19.8 Validation and CI

`scripts/validate-pack.sh` now emits a health score and checks required files, version sync, YAML parseability, Mermaid presence, placeholders, stale references, required invariants, gate SLO references, and high-risk normative duplication warnings. `.github/workflows/validate-pack.yml` provides a CI stub.

### 19.9 Decision and waiver log

Any deviation from locked order, SLO targets, privacy rules, retention rules, or compliance readiness must be recorded in `docs/process/decision-waiver-log.md` before merge.


---

## 20. v0.13 Numeric Ledger Plane Addendum

### 20.1 Decision

TigerBeetle is the target post-MVP numeric ledger plane for conserved numeric movement: financial postings, stock movements, reservations, credits, quotas, and capacity-style ledgers where a value moves from one account/state to another.

TigerBeetle is not an MVP runtime dependency. MVP remains PostgreSQL-backed, but it must implement a TigerBeetle-shaped numeric ledger contract so that the later move is adapter-scoped:

```text
Domain command handler
  -> NumericLedgerPort
  -> PostgresMvpNumericLedgerAdapter in MVP
  -> TigerBeetleNumericLedgerAdapter after P1-LEDGER-001 evidence
```

### 20.2 Source-of-truth boundary

| Area | MVP | Post-MVP target |
|---|---|---|
| Business objects, permissions, workflow, policy | PostgreSQL | PostgreSQL |
| Audit envelopes, domain events, outbox/SSE | PostgreSQL | PostgreSQL |
| Numeric movement facts | PostgreSQL `numeric_transfers` | TigerBeetle transfers |
| Ledger-derived balances | PostgreSQL projection from transfers | TigerBeetle account state, projected to PostgreSQL |
| Reporting | PostgreSQL projections | PostgreSQL projections |

`INV-001` remains true for business objects and the ERP control plane. It is refined for numeric movement: post-MVP TigerBeetle may become the source of truth for ledger-derived numeric balances, while PostgreSQL remains the source of truth for metadata, access control, workflow, outbox delivery, and reporting projections.

### 20.3 MVP implementation rules

1. All conserved numeric movement must go through `NumericLedgerPort`.
2. Financial and stock balance changes must be append-only debit/credit transfers.
3. Direct mutable balance updates outside the ledger adapter are prohibited.
4. Amounts use unsigned fixed-scale integer minor units.
5. Account IDs and transfer IDs are deterministic unsigned 128-bit decimal strings.
6. Ledger and transfer type metadata use immutable numeric codes with PostgreSQL metadata.
7. Business rules stay outside the numeric ledger adapter.
8. Outbox, audit, and command recovery remain PostgreSQL-owned and command-correlated.
9. The MVP adapter enforces target account-balance constraints before broad finance/stock features.
10. The same transfer ID with a different payload hash is a release-blocking conflict.

### 20.4 Ledgerability test

A numeric value belongs in the ledger plane only if it represents a conserved quantity or claim, changes through append-only movement events, has a source and destination account, needs idempotent mutation, requires immutable audit/reconciliation, and can be stored as an unsigned fixed-scale integer.

Prices, rates, formula outputs, forecasts, KPIs, approval thresholds, tax tables, UOM conversions, and planning assumptions stay outside the ledger plane.

### 20.5 MVP data contract

The normative MVP schema is in `docs/data/numeric-ledger-contract.md`. At minimum, MVP must include:

```text
numeric_ledger_catalog
numeric_accounts
numeric_transfers
numeric_balance_projection
numeric_ledger_migration_state
```

`numeric_balance_projection` is rebuildable and not authoritative. `numeric_transfers` is authoritative in MVP for ledger-shaped numeric movement.

### 20.6 Financial and stock posture

Financial ledger mechanics are a strong fit for the numeric ledger plane. Domain policy still owns approvals, period close, tax, and accounting treatment.

Stock quantity mechanics are also a strong fit when modeled as accounts for physical and logical states:

```text
available -> reserved -> shipped
available -> quarantine
available -> damaged
in_transit -> available
adjustment_source -> available
available -> adjustment_loss
```

Lot, serial, UOM, quality, warehouse permissions, substitute SKU rules, and manufacturing semantics remain domain-layer rules.

### 20.7 MVP strengthening from the TigerBeetle model

The MVP should borrow these TigerBeetle-shaped properties without requiring TigerBeetle to run:

| Property | MVP implementation |
|---|---|
| Account/transfer/ledger model | `numeric_accounts`, `numeric_transfers`, `numeric_ledger_catalog`. |
| Immutable movement history | Append-only `numeric_transfers`; corrections are additional transfers. |
| Deterministic idempotency | `transfer_id_dec` is generated only by the canonical derivation in `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules`. |
| Same-ID conflict detection | `transfer_payload_hash` rejects same ID with different content. |
| Balance-side constraints | `balance_constraint` checked by `PostgresMvpNumericLedgerAdapter`. |
| Multi-leg readiness | `postTransferGroup` and `ledger_group_id` preserve linked-group semantics. |
| Projection rebuild | `numeric_balance_projection` can be deleted and rebuilt from transfers. |
| Future cutover scope | `numeric_ledger_migration_state` tracks per-tenant/per-ledger stage. |

This makes financial and stock MVP logic safer even if TigerBeetle adoption is later deferred.

### 20.8 Future migration path

The future migration path is documented in `docs/plan/post-mvp-tigerbeetle-transition.md` and uses staged cutover by `(tenant_id, ledger_code)`:

```text
mvp
  -> model_freeze
  -> historical_replay
  -> passive_shadow
  -> strict_shadow
  -> cutover
  -> continuous reconciliation
```

Cutover is not global. It starts with a low-risk internal ledger, then expands to selected tenant/ledger scopes only after evidence exists.

### 20.9 Post-cutover command flow

After a ledger cuts over, command handlers still call `NumericLedgerPort`. The adapter routes authoritative movement to TigerBeetle for that scope.

```text
1. Insert/update command_log as received.
2. Validate authorization, workflow, and domain state in PostgreSQL.
3. Create TigerBeetle transfer(s) with deterministic IDs.
4. Commit PostgreSQL domain state, projection, audit/domain/outbox, and command terminal status.
5. If PostgreSQL fails after TigerBeetle succeeds, recovery derives transfer IDs and repairs projection/outbox/command status.
```

Do not introduce distributed ACID between PostgreSQL and TigerBeetle in this version. Recovery and reconciliation are mandatory design surfaces.


### 20.10 TigerBeetle Field Assignment Policy

The normative field assignment policy lives in one place only:

```text
docs/data/tigerbeetle-field-assignment-policy.md
```

This spec intentionally does not duplicate the full field table or PostgreSQL mirror DDL. The selected policy is the highest-scored hybrid model: dimension-centric accounts, movement/document-centric transfers, and PostgreSQL as the semantic index catalog.

Implementation requirements:

1. Use `docs/data/numeric-ledger-contract.md` as the single source for canonical `Transfer.id` derivation.
2. Use `docs/data/tigerbeetle-field-assignment-policy.md` as the single source for `ledger`, `code`, `user_data_128`, `user_data_64`, and `user_data_32` semantics.
3. Use PostgreSQL mirror columns and indexes for TigerBeetle `QueryFilter` and `AccountFilter` diagnostics/reconciliation.
4. Do not implement from summary tables in ADRs, gates, or this spec; those documents must point to the contract and field policy.

### 20.11 P1-LEDGER-001 adoption gate

P1-LEDGER-001 decides whether to adopt TigerBeetle for:

```text
A. financial ledger only,
B. financial and stock ledgers,
C. selected numeric ledgers,
D. no MVP-adjacent adoption.
```

The gate requires deterministic ID evidence, transfer replay, passive and strict shadow-mode reconciliation, command recovery by transfer lookup, outbox/audit correlation, post-cutover repair tests, rollback/correction posture, and SRE/security/domain sign-off.



## Appendix D. v0.13 Review Corrections

v0.13 addresses the implementation-divergence risks found in the v0.12.5 field-policy review.

### D.1 Canonical transfer ID derivation

`docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules` is the single authoritative definition of `transfer_id_dec` / TigerBeetle `Transfer.id` derivation. Other documents must link to it rather than restating hash inputs.

The canonical uniqueness proof is:

```sql
UNIQUE (tenant_id, command_id, command_line_index, movement_kind)
```

`movement_kind` stores the ledger-family-qualified canonical movement key. `ledger_family` must not be added as a separate transfer-ID input in one adapter and omitted in another.

### D.2 TigerBeetle unsigned-width compatibility

PostgreSQL mirror DDL must preserve TigerBeetle unsigned field ranges:

| TigerBeetle field | PostgreSQL mirror rule |
|---|---|
| `code` (`u16`) | `INTEGER CHECK (value >= 1 AND value <= 65535)`. |
| `ledger` (`u32`) | `BIGINT CHECK (value > 0 AND value <= 4294967295)`. |
| `user_data_32` (`u32`) | `BIGINT CHECK (value >= 0 AND value <= 4294967295)`. |
| account/transfer IDs (`u128`) | `NUMERIC(39,0)` or decimal text with reserved-ID checks. |

Do not use PostgreSQL `SMALLINT` for TigerBeetle `code` fields or signed `INTEGER` for TigerBeetle `ledger` mirrors.

### D.3 Mirror safety constraints

`tb_transfer_registry` must include:

```sql
CHECK (tb_debit_account_id <> tb_credit_account_id)
```

It must also support a post-cutover `tigerbeetle_authoritative` submission state so reconciliation can distinguish shadow rows from cutover-authoritative mirrors.

### D.4 P1 ledger gate wiring

`P1-LEDGER-001` must include CI jobs for `BENCH-LEDGER-003` through `BENCH-LEDGER-007`, `BENCH-LEDGER-FIELD-001`, same-ledger enforcement, approved-code enforcement, transfer ID canonicalization, reserved-ID boundaries, and stock semantic compatibility.

### D.5 Default stock semantic compatibility

Default stock mode uses `tenant + UOM + scale` ledgers. Therefore, command handlers and `NumericLedgerPort` must enforce source/destination compatibility before posting: SKU and UOM equality, allowed lot/serial transformations, allowed stock-status transitions, and valid warehouse/bin movement codes. Strict SKU-ledger mode remains optional after P1 evidence.


---

## 21. Schema Evolution, DDL Centralization, and Migration Playbook

### 21.1 Canonical schema sources

DDL is intentionally centralized to prevent spec/gate/dev-doc drift. The canonical sources are:

| Schema family | Canonical file | Notes |
|---|---|---|
| Command, outbox, heartbeat, transient rate-limit tables | `docs/data/command-outbox-retention-partitioning.md` | Includes `command_log`, `outbox_events`, `app_instance_heartbeats`, and `rate_limit_minute_observations`. |
| Numeric ledger MVP and TigerBeetle mirror tables | `docs/data/numeric-ledger-contract.md` | Includes `numeric_*`, `tb_*` registries/mirrors, and mirror indexes. |

The main spec may summarize tables, but must not contain `CREATE TABLE` for canonical schemas. Gates, ADRs, and dev docs must link to the canonical files.

### 21.2 Schema evolution rule

Any schema change must include:

1. Canonical DDL change in the appropriate data contract.
2. Migration note with backward/forward compatibility behavior.
3. Updated test/benchmark manifest entry when behavior changes.
4. Projection rebuild or rollback rule for any derived table.
5. Owner sign-off for privacy, SRE, security, and domain impact.

### 21.3 Migration playbook

Use expand/contract migration by default:

```text
expand schema -> dual-write/backfill if needed -> validate invariants -> switch readers -> contract old schema
```

For command/outbox tables, migrations must preserve command idempotency and replay high-watermark semantics. For numeric ledger tables, migrations must preserve deterministic ID derivation, `transfer_payload_hash`, and projection rebuildability.

### 21.4 Duplicate DDL validation

`scripts/validate-pack.sh` must fail if canonical `CREATE TABLE` definitions appear outside the approved data-contract files. Small column excerpts are allowed only as prose or non-`CREATE TABLE` snippets.


---

## 22. Post-MVP Specialized Data Planes

Version 0.13 adds a post-MVP data-plane strategy without expanding Phase 0 scope.

The target stack is:

```text
PostgreSQL  -> operational/control plane
TigerBeetle -> conserved numeric ledger plane after evidence/cutover
pgvector    -> permissioned semantic retrieval plane after MVP
DuckDB      -> derived analytical/export plane after MVP
```

Normative details live in:

```text
docs/data/post-mvp-data-planes.md
docs/data/duckdb-analytics-plane.md
docs/data/pgvector-semantic-retrieval-plane.md
docs/adr/ADR-0021-post-mvp-semantic-retrieval-pgvector.md
docs/adr/ADR-0022-post-mvp-analytical-plane-duckdb.md
docs/gates/P1-AI-001-pgvector-semantic-retrieval.md
docs/gates/P1-ANALYTICS-001-duckdb-analytics-plane.md
```

### 22.1 Selected integration strategy

The selected strategy is **Derived Artifact Planes with PostgreSQL Control**.

```text
PostgreSQL projections -> governed artifacts/chunks -> pgvector and DuckDB
```

DuckDB and pgvector are read-side accelerators. They cannot write operational PostgreSQL tables, bypass command handlers, bypass tenant/permission checks, or decide financial/stock truth.

### 22.2 DuckDB target posture

DuckDB is the post-MVP derived analytical/export plane. It should query governed Parquet/Arrow artifacts by default, with direct read-only PostgreSQL attach allowed only as an evidence-gated bridge. It must not serve the ordinary edit path.

### 22.3 pgvector target posture

pgvector is the post-MVP semantic retrieval plane. Embeddings are generated only from approved, permissioned, source-versioned chunks. Vector search may retrieve context but may not authorize access or mutate data.

### 22.4 MVP preparation

MVP projections and outbox envelopes should preserve:

```text
tenant_id, object_type, object_id, source_version, projection_version,
command_id, movement_group_id, effective_at, data_classification,
permission_scope_hash, retention_class, redaction_policy,
export_allowed, embedding_allowed, analytics_allowed
```

These fields make TigerBeetle, pgvector, and DuckDB adoption later an adapter/projection evolution rather than a domain rewrite.


---

## 23. v0.13 System Integration Strategy

**Decision:** v0.13 promotes the pack from post-MVP component planning to a system integration baseline. The selected strategy is **PostgreSQL control plane with evidence-gated specialized derived planes**.

```text
PostgreSQL = control, commands, workflow, permissions, audit, outbox, projections, lineage
TigerBeetle = conserved numeric movement after ledger cutover
pgvector = permissioned semantic retrieval over derived chunks after P1-AI evidence
DuckDB = derived analytics, export, reconciliation, and BI snapshots after P1-ANALYTICS evidence
Formula workers = TypeScript-first compute plane for spreadsheet formulas
SSE/polling = durable delivery plane sourced from PostgreSQL outbox
```

### 23.1 Alternatives considered

| Strategy | Summary | Decision |
|---|---|---|
| PostgreSQL-only monolith | Keep all operational, analytic, semantic, and ledger workloads in PostgreSQL. | MVP-compatible but rejected as post-MVP target. |
| PostgreSQL with extensions only | Use pgvector and pg_duckdb-style extensions inside PostgreSQL. | Useful to evaluate, but not default because OLTP isolation is weaker. |
| Hub-and-spoke specialized planes | PostgreSQL remains the hub; specialized engines consume contracts/artifacts. | **Selected.** |
| Event-stream-first architecture | Kafka/event lake becomes the primary integration backbone. | Later option; too much platform for Phase 0/MVP. |
| Warehouse/lakehouse-first architecture | Push analytics and AI context into external analytical storage first. | Useful scale path; rejected as the first post-MVP move. |
| Microservice database per capability | Split early into many services/data stores. | Rejected due to distributed transaction and cognitive-load risk. |
| AI-agent orchestration first | Agents choose between SQL, ledger, vector, and analytics engines. | Rejected until deterministic contracts and permissions are proven. |
| Client/edge analytics first | DuckDB/WASM or local exports drive interactive analysis. | Later feature option; not a control-plane strategy. |

### 23.2 Selected pattern

```text
User action
  -> command handler
  -> PostgreSQL command/audit/domain/outbox/projection contract
  -> optional specialized plane through an adapter or derived artifact
  -> result/reconciliation returns to PostgreSQL lineage
  -> user-visible output with deterministic permission checks
```

No specialized plane may directly mutate another specialized plane or bypass PostgreSQL command, permission, audit, outbox, or projection lineage.

### 23.3 v0.13 implementation rule

v0.13 does not expand MVP runtime scope. It defines the contracts that make future adoption safer. The only active MVP obligations are stable object IDs, projection versions, permission scope hashes, data classifications, deterministic command/movement IDs, and outbox high-watermarks for derived artifacts.

### 23.4 New normative references

```text
docs/architecture/v0.13-system-integration-strategy.md
docs/architecture/v0.13-plane-interface-contracts.md
docs/adr/ADR-0023-system-plane-integration-strategy.md
docs/gates/P1-SYNERGY-001-system-integration-boundary.md
```


## Post-MVP Outbox Fan-out and MVP Preparedness

v0.14 adds an explicit outbox evolution path. MVP remains PostgreSQL polling-first. Post-MVP fan-out is evidence-gated and may use an internal outbox dispatcher, CDC bridge, Kafka/Redpanda, NATS JetStream, or managed event bus only after `P1-OUTBOX-001` passes.

The MVP schema is prepared with `event_id`, `idempotency_key`, `route_key`, `partition_key`, `schema_version`, `data_schema`, `payload_hash`, `visibility_scope`, `data_classification`, and `target_planes`. No specialized plane may infer business events from raw table changes.

---

## 24. v0.14 Review Closure Requirements

v0.14 addresses the v0.13.2 review without expanding MVP runtime scope. The following documents are now active review-closure references:

```text
docs/onboarding/minimal-reading-path.md
docs/maintenance/normative-source-map.md
docs/data/outbox-polling-performance-contract.md
docs/data/ledger-id-derivation-reference.md
docs/dev/retrieval-revalidator.md
docs/api/retrieval-revalidator.openapi.yml
docs/ops/failure-mode-catalog.md
docs/slo-target-rationale.md
```

### 24.1 Outbox polling must remain MVP-safe

The richer outbox envelope must not regress the Phase 0 polling reader. `P0-LIVE-001` now requires `BENCH-LIVE-OUTBOX-POLL-001` evidence for a 10k-event replay window with 100 local SSE subscribers, demand-filtered payload fetch, no sequential scan on `outbox_events`, and correct `SYNC_REQUIRED` behavior under a retention gap.

### 24.2 Ledger ID derivation must be adapter-parity tested

`docs/data/ledger-id-derivation-reference.md` is the single normative source for deterministic account/transfer ID derivation. The PostgreSQL MVP adapter, SQL reference implementation, TypeScript implementation, and TigerBeetle shadow adapter must pass test-vector, fuzz, and cross-adapter parity checks before P1-LEDGER-001 opens. `LEDGER-008` is release-blocking.

### 24.3 Retrieval must be revalidated before display

`RetrievalRevalidator` is mandatory before any user-visible AI, pgvector, DuckDB, or mixed-plane answer. Derived-plane results are candidates only. They become visible only after deterministic tenant, permission, classification, source-version, redaction, and numeric-authority checks.

### 24.4 Failure modes must be centrally cataloged

The failure-mode catalog in `docs/ops/failure-mode-catalog.md` is the canonical behavior map for command ambiguity, outbox gaps, broker outages, TigerBeetle shadow mismatch, retrieval staleness, DuckDB artifact gaps, and AI command proposals.

### 24.5 Historical documents are non-normative unless listed active

Older v0.12.x reviews and changelogs remain for audit continuity. They are not implementation instructions unless referenced from the active pack index, required-doc manifest, or validation script.


---

## 25. v0.14 Implementation Readiness Closure

v0.14 closes the v0.13.2 review by adding implementation-level guidance for the first vertical-slice sprint. It does not expand MVP runtime scope.

### 25.1 Command transaction boundary

The Phase 0 command path uses a short command-claim transaction followed by a single PostgreSQL business transaction. The business transaction must include current-state writes, MVP `NumericLedgerPort` transfer writes when applicable, audit events, domain events, outbox events, and terminal command status. Required behavior is defined in `docs/dev/command-lifecycle.md`.

### 25.2 RetrievalRevalidator implementation

`RetrievalRevalidator` is now specified as middleware/decorator around retrieval endpoints. It has explicit cache-key, TTL, failure, and performance rules in `docs/dev/retrieval-revalidator.md`. No AI, pgvector, DuckDB, or mixed-plane result may become user-visible before this step.

### 25.3 Observability examples

Concrete OpenTelemetry examples and metric/alert examples are in `docs/observability/phase0-observability.md` and `docs/observability/otel-reference-v0.14.yml`.

### 25.4 TigerBeetle shadow operations

TigerBeetle remains post-MVP. `docs/ops/tigerbeetle-shadow-mode-day-in-life.md` describes passive/strict shadow operation, alert thresholds, and cutover blockers.

### 25.5 Recovery playbooks

`docs/ops/recovery-playbooks-v0.14.md` provides concrete playbooks for outbox bloat/retention gaps, command rollback, retrieval cache drift, and ledger shadow mismatch.


## v0.14 Implementation Readiness Closure

v0.14 closes the implementation-readiness review by making command transaction boundaries, RetrievalRevalidator implementation/caching, concrete OpenTelemetry examples, TigerBeetle shadow-mode operations, and recovery playbooks explicit. The change does not widen MVP runtime scope.


---

## 26. v0.14 External Systems Integration Strategy

### Decision

v0.14 adds post-MVP external-system integration planning without expanding the MVP vertical slice.

```text
MVP and Phase 0:
  PostgreSQL command/control/outbox remains authoritative.
  External integration runtime is not required.
  Prepare stable contracts, identities, classifications, and event envelopes.

Post-MVP:
  External systems integrate through governed connector boundaries.
  Outbound events originate from PostgreSQL outbox envelopes.
  Inbound mutations enter through command handlers.
  Imported reference/snapshot data enters through staged imports and explicit reconciliation.
```

### Selected integration model

The selected model is:

```text
Integration Control Plane in PostgreSQL
  + connector registry
  + connection/secrets metadata
  + external object mapping
  + inbound event intake ledger
  + outbound delivery ledger
  + reconciliation checkpoints
  + transformation policy registry

Post-MVP connector workers
  + pull APIs
  + webhooks
  + SCIM identity provisioning
  + file/SFTP/EDI-style batch exchange where needed
  + broker/CDC fan-out after P1-OUTBOX evidence
```

The system must not write directly from external connectors to operational tables. All business mutations from external systems become command proposals or command submissions and inherit command idempotency, authorization, audit, domain-event, outbox, and rollback behavior.

### External integration effects on specialized planes

| Plane | v0.14 effect |
|---|---|
| PostgreSQL command/control | Adds connector metadata, external mapping, integration event ledgers, and reconciliation checkpoints. |
| Outbox | Becomes the authoritative outbound integration source; broker/CDC fan-out remains evidence-gated. |
| TigerBeetle | External financial/stock data enters through commands and reconciliation, not direct ledger writes. |
| pgvector | External documents or SaaS content may be embedded only after classification, redaction, source lineage, and RetrievalRevalidator approval. |
| DuckDB | External analytics data is imported through governed snapshots/manifests, not direct scans of operational connectors. |
| Security/compliance | Adds OAuth/OIDC, SCIM, webhook signature, tenant routing, secret rotation, and regulated-data export controls. |

### Phase 0 preparedness requirements

Phase 0 must prepare for external systems by standardizing:

```text
tenant_id
object_type
object_id
source_version
external_system_id
external_object_type
external_object_id
idempotency_key
correlation_id
trace_id
data_classification
permission_scope_hash
schema_version
payload_hash
payload_ref
reconciliation_state
```

Phase 0 must not implement general-purpose connectors, customer-facing marketplace connectors, broker-dependent delivery, or direct external-system writeback.

### New v0.14 canonical docs

```text
docs/data/external-integration-strategy-options.md
docs/data/external-integration-contract.md
docs/dev/external-integration-adapter.md
docs/adr/ADR-0025-post-mvp-external-systems-integration-strategy.md
docs/gates/P1-INTEGRATION-001-external-systems-integration-spike.md
docs/plan/post-mvp-external-integration-transition.md
docs/ops/external-integration-runbook.md
docs/qa/external-integration-benchmark-plan.md
docs/diagrams/external-integration-and-post-mvp-planes.md
docs/security/integration-security-boundary.md
```
