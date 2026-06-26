---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP cutover prerequisite"
---

# Runbook: TigerBeetle Reconciliation

## Purpose

Compare TigerBeetle account/transfer state with PostgreSQL mirror/projection state before, during, and after cutover.

## Reconciliation checks

1. Transfer count by `(tenant_id, ledger_code, movement_kind)` matches expected PostgreSQL rows.
2. Every PostgreSQL transfer maps to a TigerBeetle transfer with the same deterministic ID and payload hash.
3. Account debits/credits match PostgreSQL `numeric_balance_projection` for the selected scope.
4. `tb_transfer_registry.submission_state` matches the ledger migration state.
5. Audit/domain/outbox command correlation exists for every business-visible movement.
6. Pending-transfer lifecycle state is reconciled for reservation ledgers.

## Mismatch handling

| Mismatch | Severity | Action |
|---|---|---|
| Missing TigerBeetle transfer in passive shadow | Ticket | Requeue shadow write. |
| Missing TigerBeetle transfer in strict shadow/cutover | Page | Pause scope and repair. |
| Same ID, different payload | Page | Block cutover; correctness incident. |
| Projection mismatch only | Page in cutover, ticket in passive shadow | Rebuild projection and compare again. |
| Missing audit/outbox correlation | Page | Treat as command correctness incident. |

## Required metrics

```text
erp_ledger_reconciliation_duration_seconds
erp_ledger_reconciliation_mismatch_total
erp_ledger_reconciliation_scope_accounts_total
erp_ledger_reconciliation_scope_transfers_total
erp_ledger_projection_rebuild_duration_seconds
```

## Required evidence

```text
ci://tests/ledger/tigerbeetle-shadow-reconciliation
ci://tests/ledger/post-cutover-pg-repair
ci://benchmarks/BENCH-LEDGER-006
```
