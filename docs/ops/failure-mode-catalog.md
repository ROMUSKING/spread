---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "centralized failure-mode catalog"
owner: "SRE Owner"
---

# Failure Mode Catalog

## Purpose

Centralize expected failure modes so gate cards, runbooks, and client behavior do not drift.

## Top failure modes

| ID | Scenario | Expected client behavior | Expected SRE/domain behavior | Required evidence |
|---|---|---|---|---|
| FM-001 | Lost HTTP response after committed command | Poll command status; no blind retry. | Verify command/audit/domain/outbox correlation. | `TC-CMD-001` |
| FM-002 | Duplicate command while first is in flight | Show pending; do not execute second mutation. | Investigate client retry storm if spike. | `command-pending-duplicate` |
| FM-003 | Command expires without audit/domain/outbox evidence | Force refresh and explicit confirmation. | TTL job may set ambiguous only under contract. | `command-status-ttl` |
| FM-004 | Outbox polling lag exceeds SLO | Continue polling; show delayed live state if needed. | Scale poller, inspect query plan, bloat, subscriber demand. | `BENCH-LIVE-001` |
| FM-005 | Outbox retention gap | `SYNC_REQUIRED`; full refresh. | Confirm retention window and partition cleanup. | `outbox-retention-gap-refresh` |
| FM-006 | Outbox payload hash mismatch | Do not apply event. | Page SRE/Security; block watermark advance. | `outbox-payload-hash-mismatch-blocks-delivery` |
| FM-007 | NOTIFY unsafe or unavailable | No user-visible failure; polling continues. | Keep NOTIFY disabled. | `BENCH-NOTIFY-001` |
| FM-008 | Broker/CDC outage post-MVP | MVP command path unaffected. | Replay from outbox checkpoint after recovery. | `broker-outage-does-not-block-command-commit` |
| FM-009 | CDC shadow mismatch | No cutover. | Compare event_id/idempotency_key/payload_hash and fix bridge. | `cdc-shadow-parity` |
| FM-010 | TigerBeetle transfer unknown outcome | Lookup deterministic transfer ID before retry. | Retry same ID or repair projection. | `ambiguous-command-lookup-by-transfer-id` |
| FM-011 | TigerBeetle same ID, different payload | Block command; page correctness owner. | Investigate adapter drift. | `transfer-payload-hash-conflict-detected` |
| FM-012 | TigerBeetle success, PostgreSQL projection failure | User sees pending/repairing if needed. | Repair projection/outbox/command status from deterministic IDs. | `post-cutover-pg-repair-after-ledger-success` |
| FM-013 | Strict shadow lag rises | No cutover; may degrade shadow mode. | Reduce load or move back to passive shadow. | `shadow-reconciliation-pg-vs-tigerbeetle-criteria` |
| FM-014 | Formula worker graph corruption | Show stale-safe state or rebuild. | Rebuild resident graph and inspect deltas. | `worker-graph-corruption-recovery` |
| FM-015 | Batch partition timeout | Fail affected partition closed. | Investigate graph size/custom rules. | `batch-partition-fuzz-hidden-dependency` |
| FM-016 | Rate limiter heartbeat stale | More conservative local budget. | Cleanup stale heartbeat rows under advisory lock. | `heartbeat-cleanup` |
| FM-017 | Credential-stuffing spike | Block before edit path. | Tune edge/auth risk controls. | `credential-stuffing-throttled-before-edit-path` |
| FM-018 | pgvector returns stale or unauthorized candidate | Revalidator drops candidate. | Audit and fix source invalidation/permission feed. | `retrieval-revalidator-required` |
| FM-019 | DuckDB artifact missing watermark | Do not show as authoritative. | Rebuild artifact/export manifest. | `duckdb-artifact-watermark-completeness` |
| FM-020 | AI suggests mutation | Render as draft command requiring explicit confirmation. | Audit assistant proposal; command handler remains authority. | `suggestions-require-command` |

## Mixed-plane chaos scenarios

| Scenario | Required outcome |
|---|---|
| Outbox lag + pgvector stale chunk + DuckDB snapshot delay | RetrievalRevalidator returns fresh deterministic PostgreSQL answer or marks result stale. |
| TigerBeetle shadow mismatch + DuckDB ledger summary query | DuckDB ledger summary is blocked from customer-visible output until reconciliation passes. |
| Broker outage + SSE polling healthy | Live updates continue via polling; derived-plane fan-out catches up later from checkpoints. |
| Command ambiguity + AI assistant answer | Assistant may explain ambiguity but cannot suggest blind retry. |
| Retention gap + analytics export | Export manifest records gap and blocks incremental artifact until full refresh/backfill. |


## v0.13.3 concrete recovery playbooks

### Playbook A: outbox bloat plus retention gap

**Trigger:** `erp_outbox_poll_sql_seconds` p99 exceeds 250 ms, `outbox_events` row count grows faster than retention cleanup, and one or more clients report `SYNC_REQUIRED`.

**Immediate response:**

1. Disable optional wake-up/fan-out workers; keep authoritative PostgreSQL polling active.
2. Confirm polling query uses `idx_outbox_events_poll_cover` or `idx_outbox_events_tenant_workbook_poll_cover` with saved `EXPLAIN (ANALYZE, BUFFERS)`.
3. Reduce `max_events_per_poll` or `max_bytes_per_poll` if payload fetch is the bottleneck.
4. Return `SYNC_REQUIRED` to affected workbooks whose high-watermark is older than retained outbox.
5. Run the retention/vacuum playbook only after confirming no active subscriber needs the soon-to-be-purged window.

**Recovery evidence:** `ci://tests/chaos/outbox-bloat-high-churn-retention-gap`.

### Playbook B: command committed but outbox delivery stalled

**Trigger:** command status shows `committed`, domain/audit/outbox rows exist, but SSE clients do not receive update within polling SLO.

**Immediate response:**

1. Query by `command_id` to confirm the outbox event and `outbox_id`.
2. Check poller local high-watermark and subscriber index for the tenant/workbook.
3. If poller skipped due to no local subscriber, force subscription `initial_snapshot` before resume.
4. If poller high-watermark passed the event but delivery was not acknowledged, mark connection stale and issue full refresh.
5. File an incident if duplicate delivery caused duplicate business effect; duplicate UI delivery alone is not a business effect if command idempotency held.

**Recovery evidence:** `ci://tests/live-update/outbox-polling-replay`.

### Playbook C: strict-shadow ledger mismatch

**Trigger:** `ledger_shadow_mismatch_count > 0` or reconciliation shows PostgreSQL MVP numeric projection and TigerBeetle shadow balance diverge.

**Immediate response:**

1. Freeze cutover for the affected `tenant_id + ledger_code`; do not disable MVP PostgreSQL ledger adapter.
2. Classify mismatch as ID derivation, payload hash, field assignment, account mapping, or transfer ordering.
3. Run `ci://tests/ledger/id-derivation-cross-adapter-parity` against the affected command/transfer inputs.
4. Rebuild PostgreSQL numeric projection from `numeric_transfers` and compare against TigerBeetle shadow transfer lookup.
5. If TigerBeetle contains a valid extra transfer, create a correction/void path only through the P1 ledger runbook; do not patch balances manually.

**Recovery evidence:** `ci://tests/ledger/shadow-reconciliation-pg-vs-tigerbeetle-criteria`.


## v0.13.3 playbook link

Detailed recovery procedures are in `docs/ops/recovery-playbooks-v0.13.3.md`.

## v0.14.1 external integration failure modes

| ID | Failure | Required behavior |
|---|---|---|
| FM-EXT-001 | inbound malware scan quarantines payload | no command proposal; dead letter or rejection |
| FM-EXT-002 | same idempotency key with different payload hash | `INTEGRATION_IDEMPOTENCY_CONFLICT`; no business effect |
| FM-EXT-003 | revoked credential used | block intake/delivery; audit event |
| FM-EXT-004 | mapping conflict for external object | block command proposal; require mapping repair |
| FM-EXT-005 | outbound connector outage | command commits unaffected; retry/dead-letter |
| FM-EXT-006 | adapter tries direct repository or ledger import | CI failure |
