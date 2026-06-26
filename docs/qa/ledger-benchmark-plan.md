# Ledger Benchmark and Reconciliation Plan

**Version:** 0.13  
**Status:** P1 spike plan  
**Owner:** QA Owner + Domain Ledger Owner  
**SLO reference:** `docs/slo-baseline.yml#benchmarks.BENCH-LEDGER-001`

## Benchmarks

| ID | Scenario | Target | Required CI jobs |
|---|---|---|---|
| BENCH-LEDGER-001 | PostgreSQL MVP adapter posts 1k/10k transfers with projection updates. | No duplicate transfer IDs; no projection mismatch; p95 within SLO. | `ci://benchmarks/BENCH-LEDGER-001` |
| BENCH-LEDGER-002 | TigerBeetle shadow adapter posts the same movement plan. | Transfer IDs and balances reconcile; cutover decision evidence produced. | `ci://benchmarks/BENCH-LEDGER-002` |
| BENCH-LEDGER-003 | Stock receive/reserve/ship/adjust flow, including pending/post/void/expiry lifecycle. | No negative available stock; default stock semantic compatibility enforced; pending expiry and pending-to-posted targets met. | `ci://benchmarks/BENCH-LEDGER-003`, `ci://tests/ledger/stock-default-semantic-compatibility` |
| BENCH-LEDGER-004 | Financial multi-leg posting group. | Debits and credits reconcile by ledger group; linked group semantics tested. | `ci://benchmarks/BENCH-LEDGER-004`, `ci://tests/ledger/financial-balanced-posting-flow` |
| BENCH-LEDGER-005 | Ambiguous command recovery through deterministic transfer lookup. | Command resolves without blind retry. | `ci://benchmarks/BENCH-LEDGER-005`, `ci://tests/ledger/ambiguous-command-lookup-by-transfer-id` |
| BENCH-LEDGER-006 | Post-cutover PostgreSQL failure after ledger success. | Recovery repairs projection/outbox/command status. | `ci://benchmarks/BENCH-LEDGER-006`, `ci://tests/ledger/post-cutover-pg-repair-after-ledger-success` |
| BENCH-LEDGER-007 | PostgreSQL mirror index plan for TigerBeetle field assignments. | QueryFilter-like and AccountFilter-like paths use intended indexes; no broad sequential scan on pilot fixtures. | `ci://benchmarks/BENCH-LEDGER-007`, `ci://tests/ledger/tb-query-filter-mirror-indexes-present`, `ci://tests/ledger/tb-account-filter-mirror-indexes-present` |
| BENCH-LEDGER-FIELD-001 | Field-assignment policy and mirror DDL validation. | Full u16/u32/u128-compatible ranges, canonical transfer ID pointers, and registry constraints are present. | `ci://benchmarks/BENCH-LEDGER-FIELD-001` |

## Required test data

- `pilot-v1-small` for vertical slice.
- `pilot-v1-10k` for 10k transfer and stock-movement tests.
- One finance fixture with at least 100 accounts and 10k transfers.
- One stock fixture with at least 100 SKUs, 10 warehouses/bins, lots, reserved state, quarantine state, adjustment accounts, and cross-SKU negative fixtures.
- One migration fixture with deterministic IDs generated twice from separate processes and compared byte-for-byte.
- One pending-transfer fixture covering create pending, post pending, void pending, expiry, and expired-pending recovery.

## Reconciliation checks

```text
1. Aggregate numeric_transfers by account.
2. Compare aggregate debits/credits to numeric_balance_projection.
3. In shadow mode, compare projection aggregates to TigerBeetle account balances.
4. Verify all command IDs in transfers have audit/domain/outbox correlation.
5. Verify no direct balance update statements exist outside the adapter.
6. Verify same transfer ID with different payload is rejected.
7. Verify post-cutover recovery can repair PostgreSQL after TigerBeetle success.
8. Verify tb_field_assignment_policy rows exist for each ledger family.
9. Verify PostgreSQL mirror indexes support QueryFilter-like and AccountFilter-like access paths.
10. Verify default hybrid field assignment and optional strict SKU-ledger admission evidence.
11. Verify debit and credit accounts are on the same ledger before posting.
12. Verify default stock mode rejects cross-SKU movement unless an approved transformation rule exists.
13. Verify MVP code usage is limited to tb_code_registry.allowed_in_mvp = true.
```

## Failure handling

Any mismatch blocks TigerBeetle adoption for that ledger scope. The MVP PostgreSQL adapter remains the authoritative runtime until reconciliation is clean and owner sign-off exists.

## Field assignment policy

TigerBeetle `ledger`, `code`, and `user_data_*` assignments are governed by `docs/data/tigerbeetle-field-assignment-policy.md`. The accepted model is hybrid: dimension-centric accounts plus movement-group-centric transfers, with PostgreSQL as the semantic index catalog.

## Shadow versus PostgreSQL comparison criteria

`BENCH-LEDGER-002` and later cutover benchmarks must report PostgreSQL MVP adapter results and TigerBeetle shadow/cutover results side by side.

| Metric | PostgreSQL MVP adapter | TigerBeetle shadow/cutover | Pass rule |
|---|---:|---:|---|
| 10k transfer post p95 | measured | measured | TigerBeetle path must not exceed agreed overhead or must be explicitly waived. |
| Projection rebuild p95 | measured | measured from TigerBeetle-derived facts | Both must meet SLO. |
| Reconciliation p99 | N/A or projection-only | measured | `<= ledger_reconciliation_p99_s`. |
| Shadow lag p99 | N/A | measured | `<= ledger_shadow_lag_p99_s`. |
| Balance mismatches | 0 | 0 | Any unresolved mismatch blocks cutover. |
| Duplicate transfer replay | idempotent | idempotent | Same payload is success; different payload blocks. |

## High-cardinality stock test

Default stock mode uses tenant+UOM ledger plus PostgreSQL semantic compatibility checks. BENCH-LEDGER-007 must include a high-cardinality SKU/warehouse/lot fixture:

```text
10k SKUs
100 warehouses/sites or realistic pilot equivalent
multiple stock statuses
at least one forbidden cross-SKU move fixture
at least one allowed stock transformation fixture with explicit domain approval
```

Required evidence:

```text
ci://tests/ledger/high-cardinality-sku-query-plan
ci://tests/ledger/stock-default-cross-sku-semantic-compatibility-fixtures
ci://tests/ledger/stock-transformation-approval-required
```
