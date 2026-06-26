---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "implementation-readiness baseline"
---

# Ledgerability Classification

## Purpose

Decide which numeric fields and mutations must be modeled through `NumericLedgerPort` in MVP and which may remain ordinary PostgreSQL/domain/formula values.

## Ledgerability test

A numeric field or mutation is ledgerable only if all are true:

1. It represents a conserved quantity, claim, balance, reservation, allowance, liability, credit, quota, or capacity unit.
2. It changes through append-only movement records.
3. It has a clear debit/source account and credit/destination account.
4. The amount can be represented as an unsigned fixed-scale integer.
5. Duplicate execution would be materially unsafe.
6. Unknown outcome must be recoverable by deterministic command/transfer identity.
7. History must be immutable and reconcilable.
8. Metadata can live outside the numeric ledger plane in PostgreSQL.

If any answer is no, keep the value in PostgreSQL domain tables, policy/config tables, formula workers, or analytical projections.

## Classification table

| Numeric area | Ledgerable? | MVP treatment | Post-MVP TigerBeetle treatment |
|---|---:|---|---|
| GL journal postings | Yes | PostgreSQL `numeric_transfers` | TigerBeetle transfers after cutover. |
| Cash/bank movements | Yes | PostgreSQL `numeric_transfers` | TigerBeetle transfers. |
| AR/AP balance movements | Yes | PostgreSQL `numeric_transfers` | TigerBeetle transfers. |
| Customer/supplier credits | Yes | PostgreSQL `numeric_transfers` | TigerBeetle transfers if P1 evidence passes. |
| Stock on hand | Yes | PostgreSQL stock transfer-shaped movement | TigerBeetle inventory accounts/transfers. |
| Stock reservation | Yes | PostgreSQL reservation transfer/status-account movement | TigerBeetle pending transfer or reserved-account transfer after P1 evidence. |
| Stock quarantine/damaged/in-transit | Yes | Stock-status account transfer | Stock-status accounts in TigerBeetle. |
| Budget consumption | Maybe | Classify per domain owner | TigerBeetle only if conserved and account-shaped. |
| Capacity reservation | Maybe | Classify per domain owner | TigerBeetle only if conserved and account-shaped. |
| Loyalty/points/allowances | Maybe | Classify per domain owner | TigerBeetle only if conserved and account-shaped. |
| Unit price | No | PostgreSQL attribute | PostgreSQL attribute. |
| Tax rate | No | PostgreSQL policy/config | PostgreSQL policy/config. |
| Approval threshold | No | PostgreSQL policy/config | PostgreSQL policy/config. |
| Formula result | Usually no | Formula worker/projection | Formula worker/projection. |
| Forecast quantity | No | PostgreSQL planning data | PostgreSQL planning data. |
| KPI metric | No | Analytical/projection | Analytical/projection. |
| UOM conversion factor | No | PostgreSQL policy/config | PostgreSQL policy/config. |

## Default decision

Ledgerable by default:

```text
money movements
stock movements
stock reservations
customer/supplier credits
other conserved allowances after owner approval
```

Not ledgerable by default:

```text
prices
rates
thresholds
formulas
forecasts
scores
manual KPI inputs
configuration values
UOM conversion factors
```

## Owner rule

A new ledgerable numeric type requires sign-off from:

```text
Domain Owner + Engineering Lead + SRE Owner + Security Owner
```

A financial ledgerable type also requires Finance/Compliance owner sign-off.

## Required evidence

```text
ci://tests/ledger/ledgerability-classification
ci://tests/ledger/non-ledgerable-numeric-field-rejected
ci://tests/ledger/ledgerable-command-uses-numeric-ledger-port
```
