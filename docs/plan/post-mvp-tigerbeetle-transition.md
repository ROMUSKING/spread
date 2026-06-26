---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "transition plan"
---

# Post-MVP TigerBeetle Transition Plan

## Goal

Move ledger-shaped numeric movement from PostgreSQL MVP tables to TigerBeetle without changing command handlers, client UX, audit/outbox contracts, or domain workflow semantics.

The migration must be adapter-scoped. A customer-visible command should continue to behave as a command; only the backing implementation of `NumericLedgerPort` changes for selected `(tenant_id, ledger_code)` scopes.

## Cutover unit

Cut over by tenant and ledger, not globally:

```text
cutover_scope = tenant_id + ledger_code
```

Do not cut over all financial, stock, and credit ledgers together. The preferred sequence is:

1. Internal demo tenant, non-critical credit/quota ledger.
2. Internal finance-like money ledger.
3. Pilot tenant financial ledger.
4. Pilot tenant stock ledger only after reservation/expiry semantics are proven.
5. Broader tenant cohorts.

## Phase 0/MVP preparation

These are mandatory before MVP financial or stock features broaden:

- Implement `NumericLedgerPort`.
- Store deterministic account IDs and transfer IDs as unsigned 128-bit decimal text.
- Store all conserved numeric movement as append-only transfers.
- Keep balance projections rebuildable.
- Emit `ledger_group_id` in audit/domain/outbox events.
- Block direct mutable financial and stock balance updates outside the adapter.
- Store `transfer_payload_hash` and reject same transfer ID with different payload.
- Add `numeric_ledger_migration_state` and initialize every ledger to `stage = 'mvp'`.

## Migration stages

| Stage | Authority | Purpose | Exit evidence |
|---|---|---|---|
| `mvp` | PostgreSQL `numeric_transfers` | Normal MVP runtime. | Projection rebuild passes. |
| `model_freeze` | PostgreSQL | Freeze ledger catalog, account-key rules, transfer-code mappings, and ID derivation. | Owner sign-off and hash parity tests. |
| `historical_replay` | PostgreSQL | Import/replay MVP account catalog and transfers into a TigerBeetle test/shadow cluster. | Replay idempotency and balance reconciliation. |
| `passive_shadow` | PostgreSQL | New commands remain PostgreSQL-authoritative; a durable worker posts equivalent movements to TigerBeetle. | Shadow lag and reconciliation SLOs pass. |
| `strict_shadow` | PostgreSQL | New commands require TigerBeetle shadow success before being considered migration-ready, but PostgreSQL remains authoritative. | Zero mismatch soak period. |
| `cutover` | TigerBeetle for selected ledger | `NumericLedgerPort` routes authoritative movement to TigerBeetle; PostgreSQL projections/outbox remain. | Command, recovery, projection, and outbox tests pass. |
| `rollback` | PostgreSQL for new commands | Stop new TigerBeetle-authoritative writes for scope; repair projections/reconciliation. This stage also exists in `tb_ledger_registry.migration_state`. | Domain/SRE/Security review. |

## Detailed migration path

### 1. Model freeze

Freeze:

- `ledger_code` allocation.
- `transfer_code` allocation.
- account-key canonicalization.
- `account_id_dec` and `transfer_id_dec` derivation.
- money scale and stock unit scale.
- stock account dimensions and status taxonomy.
- account constraint mapping.

No cutover may proceed if any command handler still builds mutable balance updates outside `NumericLedgerPort`.

### 2. Account import rehearsal

Export `numeric_ledger_catalog` and `numeric_accounts` for the target scope. Create the corresponding TigerBeetle accounts using deterministic IDs.

Rules:

- Metadata stays in PostgreSQL.
- TigerBeetle receives only numeric IDs, ledger codes, account codes, flags, and supported user-data identifiers.
- Account creation treats `exists` with matching payload as success.
- Same account ID with different payload blocks migration.

### 3. Historical transfer replay

Replay `numeric_transfers` into TigerBeetle using deterministic `transfer_id_dec` and stable ordering. The default plan does not depend on imported TigerBeetle timestamps; original business timestamps remain in PostgreSQL metadata.

Replay rules:

- Batches are grouped by ledger and linked-group boundaries.
- Same transfer ID with matching payload is success.
- Same transfer ID with different payload blocks migration.
- Rebuild PostgreSQL projection and compare to TigerBeetle account state after each replay batch group.

### 4. Passive shadow mode

New MVP commands remain PostgreSQL-authoritative. A durable shadow worker posts the same movement plan to TigerBeetle.

```text
command transaction
  -> numeric_transfers authoritative in PostgreSQL
  -> domain/audit/outbox commit
  -> ledger shadow queue
  -> TigerBeetle shadow adapter
  -> reconciliation report
```

Passive shadow must not alter client-visible command success. It produces migration evidence.

### 5. Strict shadow mode

For a short, owner-approved soak period, new commands for the candidate scope must also succeed in TigerBeetle shadow before the scope is considered cutover-ready. PostgreSQL still remains authoritative during this stage.

Strict shadow blocks cutover if:

- TigerBeetle rejects a transfer that PostgreSQL accepts.
- PostgreSQL accepts a transfer that would violate the target account constraint.
- Shadow lag exceeds SLO.
- Any command loses audit/domain/outbox correlation.

### 6. Cutover

Set:

```text
numeric_ledger_catalog.authoritative_engine = 'tigerbeetle'
numeric_ledger_migration_state.stage = 'cutover'
tb_ledger_registry.migration_state = 'cutover'
```

After cutover, `NumericLedgerPort` routes authoritative transfer creation for the scope to TigerBeetle.

Recommended command flow after cutover:

```text
1. Insert/update command_log as received.
2. Validate authorization, workflow, and domain state in PostgreSQL.
3. Create TigerBeetle transfer(s) with deterministic IDs.
4. Commit PostgreSQL domain state, projection, audit/domain/outbox, and command terminal status.
5. If step 4 fails after step 3 succeeds, recovery derives transfer IDs and repairs projection/outbox/command status.
```

Do not use a distributed transaction protocol between PostgreSQL and TigerBeetle in this phase. Recovery and reconciliation are the safety mechanism.

### 7. Post-cutover reconciliation

Run reconciliation continuously for the cutover scope:

```text
TigerBeetle account state
  vs PostgreSQL projection
  vs audit/domain/outbox command correlation
```

Any mismatch pages SRE and blocks broader cutover.

### 8. Rollback posture

TigerBeetle transfers are immutable. Rollback does not mean deleting ledger facts.

Rollback means:

- Pause new commands for the affected scope if correctness is uncertain.
- Route new commands back to `PostgresMvpNumericLedgerAdapter` only after owner approval.
- Keep TigerBeetle facts for forensic reconciliation.
- Add correcting transfers if business facts were posted incorrectly.
- Rebuild PostgreSQL projections from the selected authoritative source.
- Record the decision in `docs/process/decision-waiver-log.md`.

## Cutover criteria

A ledger may be moved to TigerBeetle only when all are true:

1. Deterministic IDs match between MVP and TigerBeetle adapter.
2. Transfer replay is complete and idempotent.
3. Balance reconciliation passes for all accounts in scope.
4. Command recovery works from transfer lookup.
5. Projection rebuild works from TigerBeetle-derived transfer facts.
6. Outbox delivery remains PostgreSQL-owned.
7. Passive and strict shadow modes meet SLOs.
8. SRE signs operational readiness.
9. Security signs isolation and access posture.
10. Domain owner signs ledger account modeling.
11. Rollback and correction plan is documented.
12. Customer-support playbook exists for ambiguous ledger outcomes.

## Non-goals

- Do not migrate formula outputs, prices, rates, forecasts, KPI metrics, approval thresholds, or tax/UOM tables to TigerBeetle.
- Do not replace the PostgreSQL outbox.
- Do not move authorization, workflow, approval, lot/serial, tax, or compliance checks into TigerBeetle.
- Do not expose TigerBeetle directly to browsers or untrusted services.



## Field-assignment prerequisite

Before any ledger enters `passive_shadow`, `docs/data/tigerbeetle-field-assignment-policy.md` must have an approved policy version for the ledger family. PostgreSQL mirror rows must include exact TigerBeetle `ledger`, `code`, `user_data_128`, `user_data_64`, `user_data_32`, timestamp, flags, and payload-hash fields.


## P1-LEDGER-001 adoption decision vocabulary

The ledger spike must end with one of these explicit decisions:

```text
ADOPT_FINANCIAL_ONLY
ADOPT_FINANCIAL_AND_STOCK
ADOPT_SELECTED_LEDGER_FAMILIES
DEFER_TIGERBEETLE
```

The preferred rollout sequence remains:

```text
financial ledger pilot -> financial ledger rollout -> stock ledger pilot -> stock ledger rollout -> optional credit/capacity ledgers
```


## Shadow SLOs and operational budget

Passive and strict shadow mode introduce dual-write-like operational load even though PostgreSQL remains authoritative. The SLO baseline is normative:

```text
ledger_shadow_lag_p99_s <= 60
ledger_reconciliation_p99_s <= 120
ledger_strict_shadow_write_overhead_p95_ms <= 100
ledger_shadow_mismatch_rate_allowed = 0
```

Strict shadow may not run for broad tenant cohorts until `BENCH-LEDGER-002` and `BENCH-LEDGER-006` pass for the pilot dataset and expected transfer volume.


## Replay window sizing

Set the replay window per cutover scope before entering `historical_replay`:

| Scope type | Default replay window | Notes |
|---|---:|---|
| Internal/demo ledger | 7 days | Enough for adapter validation. |
| Pilot financial ledger | 30 days minimum | Extend to full ledger history if operational reports require it. |
| Pilot stock ledger | 30 days plus all open reservations/lots | Must include active reservation/pending lifecycle. |
| Regulated ledger | Legal/compliance-defined | May require full historical import or no cutover until legal sign-off. |

Historical import into TigerBeetle is optional when operational balances can start from a validated cutover point. If historical import is required, treat it as a separate migration project with scheduled maintenance, replay checkpoints, and reconciliation after every batch group.


## Required runbooks before production cutover

These runbooks are not required for MVP, but are required before any production TigerBeetle cutover:

```text
docs/ops/tigerbeetle-shadow-worker-runbook.md
docs/ops/tigerbeetle-reconciliation-runbook.md
docs/ops/tigerbeetle-cutover-rollback-runbook.md
```
