# TigerBeetle Shadow Mode Day-in-the-Life

**Version:** 0.13.3  
**Last-reviewed:** 2026-06-26  
**Status:** P1-LEDGER operational realism companion

## Purpose

Describe what passive and strict shadow look like operationally before any TigerBeetle cutover. This document prevents shadow mode from becoming an invisible latency or reconciliation tax.

## Daily operating loop

```text
09:00  Review prior-day shadow mismatch count and reconciliation windows.
09:15  Check strict-shadow latency overhead by ledger family.
09:30  Review transfer payload hash conflicts and ID derivation parity failures.
10:00  Replay a sampled window from PostgreSQL MVP transfers into shadow adapter fixtures.
12:00  Verify projection repair queue is empty or within SLO.
15:00  Run same-ledger and stock semantic compatibility checks on sampled stock movements.
17:00  Decide whether ledger remains passive, strict-shadow, or blocked from cutover.
```

## Resource expectations

| Resource | Passive shadow | Strict shadow |
|---|---:|---:|
| Command commit impact | None on request path; async worker only | Must remain within `ledger_strict_shadow_write_overhead_p95_ms` if request-adjacent. |
| Worker CPU | Scales with transfer volume and reconciliation cadence | Higher; includes synchronous parity checks where configured. |
| Storage | PostgreSQL mirror rows plus shadow result metadata | Same plus stricter audit trail and mismatch payloads. |
| Operator attention | Daily mismatch review | Daily mismatch review plus latency budget review. |

## Reconciliation query pattern

```text
1. Select numeric_transfers for tenant_id + ledger_code + time window.
2. Derive canonical transfer IDs using `docs/data/ledger-id-derivation-reference.md`.
3. Fetch TigerBeetle transfer/account state through shadow adapter.
4. Compare amount, debit, credit, ledger, code, user_data fields, payload hash, and projection balance.
5. Emit mismatch records keyed by tenant_id + ledger_code + transfer_id_dec.
```

## Alert thresholds

| Signal | Threshold | Action |
|---|---:|---|
| `ledger_shadow_mismatch_count` | any non-zero | Block cutover and open correctness incident. |
| `ledger_id_derivation_parity_failures_total` | any non-zero | Block P1-LEDGER and run adapter parity test vectors. |
| `ledger_transfer_payload_hash_conflict_total` | any non-zero | Page Backend/API owner. |
| strict-shadow overhead p95 | > 100 ms | Disable strict shadow for affected ledger family. |
| reconciliation p99 | > 120 s | Increase worker capacity or reduce window size; no cutover. |

## Cutover readiness checklist

```text
zero mismatches for agreed windows
strict-shadow overhead under SLO
same-ledger rejection evidence present
stock semantic compatibility tests green
payload hash conflict tests green
projection repair drill completed
owner sign-off recorded
rollback path rehearsed
```
