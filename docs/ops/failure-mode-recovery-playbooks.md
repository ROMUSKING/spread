# Failure Mode Recovery Playbooks

**Version:** 0.13.3  
**Last-reviewed:** 2026-06-26  
**Status:** implementation-readiness runbook companion

## Purpose

Turn the failure-mode catalog into concrete operator/client behavior for the most likely vertical-slice and early Phase 0 failures.

## Playbook 1: Outbox bloat plus retention gap

**Symptoms**

```text
erp_outbox_poll_cycle_seconds p99 > 0.75s
erp_outbox_payload_bytes_fetched_total p95 > 2 MiB
erp_outbox_retention_gap_total increments
clients receive SYNC_REQUIRED or full-refresh trigger
```

**Immediate action**

1. Confirm pollers are using envelope metadata scan before payload fetch.
2. Confirm no `Seq Scan` in saved `EXPLAIN (ANALYZE, BUFFERS)` evidence.
3. Increase full-refresh preference for affected workbooks; do not widen payload-per-poll cap without SRE approval.
4. Verify retention job did not purge before all active subscriber watermarks advanced.
5. Mark affected SSE clients `SYNC_REQUIRED` and force snapshot reload.

**Recovery**

```text
pause retention purge for affected tenant/workbook
run replay-window diagnostic query
compare subscriber high-watermarks with oldest retained outbox_id
force full refresh for subscribers behind oldest retained outbox_id
resume retention only after high-watermark convergence
```

**Required evidence**

```text
ci://tests/chaos/outbox-bloat-high-churn-retention-gap
ci://benchmarks/BENCH-LIVE-OUTBOX-POLL-001
```

## Playbook 2: Command stuck in received state

**Symptoms**

```text
command_log.command_status = received beyond command execution timeout
client shows pending command ID
no terminal response available
```

**Immediate action**

1. Search correlated audit/domain/outbox records by `tenant_id + command_id`.
2. If correlated committed records exist, repair command status to `committed` and attach redacted/encrypted response reference.
3. If no correlated records exist and the mutation transaction rolled back, mark `failed` where safe.
4. If TTL expires and evidence is inconclusive, mark `ambiguous` and force workbook refresh before retry.

**Client behavior**

```text
show pending while received is inside timeout
show refresh-required ambiguity after terminal ambiguity or expiry
never auto-submit a new command ID
```

**Required evidence**

```text
ci://tests/command/recovery-repairs-stale-received-with-correlated-outbox
ci://tests/e2e/TC-CMD-001-network-loss-after-commit
```

## Playbook 3: TigerBeetle strict-shadow mismatch

**Symptoms**

```text
ledger_shadow_mismatch_count > 0
ledger_transfer_payload_hash_conflict_total increments
shadow adapter creates exists_different_payload or balance mismatch
```

**Immediate action**

1. Disable strict-shadow promotion for the affected `tenant_id + ledger_code`.
2. Keep MVP PostgreSQL ledger authoritative.
3. Capture transfer ID, payload hash, movement kind, command ID, and adapter version.
4. Run SQL/TypeScript/TigerBeetle adapter ID derivation parity tests against the same inputs.
5. Reconcile transfer projections for the affected window.

**Recovery**

```text
fix adapter or mapping drift
replay passive shadow over affected window
require zero mismatch for two consecutive windows before re-entering strict shadow
require owner sign-off before cutover
```

**Required evidence**

```text
ci://tests/ledger/id-derivation-cross-adapter-parity
ci://tests/ledger/strict-shadow-latency-budget
ci://tests/ledger/tigerbeetle-shadow-day-in-life-drill
```

## Playbook 4: RetrievalRevalidator regulated-data block

**Symptoms**

```text
erp_retrieval_regulated_candidates_blocked_total increments
retrieval response filters candidates
Security/Compliance alert fires in production
```

**Immediate action**

1. Do not return the blocked candidate text to the user.
2. Capture source ID, chunk ID, data classification, redaction policy version, and retrieval ID.
3. Verify `embedding_allowed` and source classification state.
4. Invalidate affected chunks/embeddings if classification drift is confirmed.
5. Run regulated-data escape test before restoring source.

**Recovery**

```text
update classification or redaction policy
invalidate stale semantic chunks
rebuild embeddings only after compliance approval
return deterministic-only degraded answer until rebuild completes
```

## Playbook 5: Mixed-plane failure cascade

**Symptoms**

```text
DuckDB artifact stale
pgvector embedding lag high
ledger projection repair delayed
user asks cross-plane question
```

**Required behavior**

```text
RetrievalRevalidator filters stale candidates
answer cites only deterministic PostgreSQL/TigerBeetle-derived projections that are current enough
analytics/AI sections are marked unavailable or stale
no mutation proposal is emitted without command confirmation
```

**Required evidence**

```text
ci://tests/chaos/mixed-plane-failure-cascade
ci://tests/synergy/retrieval-revalidator-runs-before-cross-plane-answer
```
