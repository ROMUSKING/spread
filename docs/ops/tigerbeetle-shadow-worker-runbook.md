---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP cutover prerequisite"
---

# Runbook: TigerBeetle Shadow Worker

## Purpose

Operate the worker that posts PostgreSQL-authoritative MVP numeric transfers into TigerBeetle during `passive_shadow` and `strict_shadow` stages.

## Normal operation

1. Read shadow-eligible `numeric_transfers` by `(tenant_id, ledger_code)` and deterministic `transfer_id_dec`.
2. Ensure the target `tb_ledger_registry` row is in `passive_shadow` or `strict_shadow`.
3. Create missing TigerBeetle accounts idempotently from `numeric_accounts` and `tb_account_registry`.
4. Create TigerBeetle transfers using the canonical ID contract.
5. Treat `exists` with matching payload hash as success.
6. Mark mismatched payload or field errors as `exists_different_payload` and block cutover.
7. Emit reconciliation metrics and raw evidence URI.

## Metrics

```text
erp_ledger_shadow_lag_seconds
erp_ledger_shadow_batch_duration_seconds
erp_ledger_shadow_create_transfer_results_total
erp_ledger_shadow_payload_mismatch_total
erp_ledger_shadow_account_create_results_total
```

## Alerts

| Condition | Response |
|---|---|
| Shadow lag breaches SLO | Scale worker or reduce candidate scope. |
| Payload mismatch | Page ledger correctness owner; block cutover. |
| Account missing in strict shadow | Stop strict shadow for scope and repair account import. |
| TigerBeetle unavailable | Keep PostgreSQL authoritative; shadow can retry same IDs. |

## Required evidence

```text
ci://tests/ledger/shadow-worker-idempotent-replay
ci://tests/ledger/shadow-mismatch-blocks-cutover
ci://benchmarks/BENCH-LEDGER-002
```
