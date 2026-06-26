---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-mvp target model"
---

# TigerBeetle Target Model

## Purpose

This document defines how the MVP numeric ledger shape maps to TigerBeetle after MVP. It is a target model, not a Phase 0 runtime dependency.

## Facts used by this model

- TigerBeetle models numeric movement with accounts, transfers, and ledgers.
- Ledgers are numeric identifiers; descriptive metadata stays in the application control plane.
- A transfer debits one account and credits one account on the same ledger.
- Transfers are immutable and cannot be deleted; corrections are additional transfers.
- Account flags can enforce non-negative debit-side or credit-side balance behavior.
- Two-phase transfers model pending, post-pending, void-pending, and expiry flows.
- TigerBeetle clients use integer types wider than JavaScript `Number`; the TypeScript integration must use `BigInt`/string conversion boundaries.

## Division of responsibilities

| Responsibility | PostgreSQL/control plane | TigerBeetle/numeric ledger plane |
|---|---|---|
| Tenant, user, workbook, role, permission metadata | Yes | No |
| Product, invoice, purchase order, workflow state | Yes | No |
| Ledger/account metadata and string names | Yes | Numeric codes and IDs only |
| Transfer facts for conserved numeric movement | Projection/import mirror after cutover | Yes |
| Ledger-derived balances | Projection/cache/reporting | Yes |
| Audit envelope and outbox/SSE | Yes | No |
| Authentication and authorization | Yes | No |

TigerBeetle must not be exposed directly to users, browsers, or untrusted services.


## Field assignment policy

The normative assignment of TigerBeetle `ledger`, `code`, and `user_data_*` fields is `docs/data/tigerbeetle-field-assignment-policy.md`. The chosen model is the highest-scored hybrid option:

```text
Account.user_data_128  = account_dimension_group_id
Transfer.user_data_128 = movement_group_id
Transfer.id            = canonical command-line transfer ID from docs/data/numeric-ledger-contract.md
PostgreSQL             = semantic index catalog and mirror
```

Do not use raw `command_id` as default `Transfer.user_data_128`. Store `command_id` in PostgreSQL mirror tables and use the canonical transfer ID derivation in `docs/data/numeric-ledger-contract.md`. Do not restate the derivation tuple here.

Do not change field meaning in place. New meaning requires a new policy version, mirror-index migration, and reconciliation evidence.

## Mapping

| ERP concept | TigerBeetle field |
|---|---|
| `numeric_ledger_catalog.ledger_code` | `Account.ledger`, `Transfer.ledger` |
| `numeric_accounts.account_id_dec` | `Account.id` |
| `numeric_accounts.account_kind` | `Account.code` mapping |
| `numeric_accounts.balance_constraint` | account balance-invariant flags |
| `numeric_transfers.transfer_id_dec` | `Transfer.id` |
| `numeric_transfers.debit_account_id_dec` | `Transfer.debit_account_id` |
| `numeric_transfers.credit_account_id_dec` | `Transfer.credit_account_id` |
| `numeric_transfers.amount_minor` | `Transfer.amount` |
| `numeric_transfers.transfer_code` | `Transfer.code` mapping |
| `ledger_group_id` or domain object pointer | `Transfer.user_data_128` or PostgreSQL metadata |
| `pending_transfer_id_dec` | `Transfer.pending_id` |
| `original_business_at` | PostgreSQL metadata by default; optional imported timestamp strategy only after migration review |

## Finance model

Financial accounts use one ledger per tenant and asset/currency combination unless a later scale review selects a different partitioning scheme.

Examples:

```text
ledger_key = money:GBP
ledger_code = 826
account_key = gl:cash:bank_primary
account_key = gl:ar:customer:<customer_id>
account_key = gl:revenue:sales
```

Financial postings with multiple debit/credit legs are represented as a linked group of one-to-one transfers. The ERP domain layer owns accounting policy, tax calculation, period-close checks, and approval workflow.

## Stock model

Stock accounts use dimensions that identify physical or logical stock state:

```text
stock:<sku_id>:<warehouse_id>:<bin_id>:<lot_id>:available
stock:<sku_id>:<warehouse_id>:<bin_id>:<lot_id>:reserved
stock:<sku_id>:<warehouse_id>:<bin_id>:<lot_id>:quarantine
stock:<sku_id>:<warehouse_id>:<bin_id>:<lot_id>:shipped
```

A reservation can be represented either as a transfer from `available` to `reserved` or as a TigerBeetle pending transfer. The target decision is deferred to P1-LEDGER-001 because UX expectations around expiry, release, and partial fulfillment must be benchmarked and tested.

## Migration timestamp posture

The default migration path does not require preserving PostgreSQL historical timestamps as TigerBeetle cluster timestamps. Store original business time in PostgreSQL metadata and use TigerBeetle cluster timestamps for ledger order after import.

If a future migration requires imported TigerBeetle timestamps, it needs a separate maintenance-window plan because imported timestamps are constrained, strictly ordered, and most suitable for fresh-cluster import.

## Non-ledger numeric data

The following stay outside TigerBeetle:

- Prices and rates.
- Formula outputs and KPIs.
- Forecast quantities.
- Approval thresholds.
- Standard cost master data.
- UOM conversion tables.
- Tax tables.
- Planning assumptions.

## Cutover rule

A tenant or asset class may cut over to TigerBeetle only after:

1. MVP numeric accounts and transfers import cleanly.
2. Shadow posting produces identical transfer IDs and balances.
3. Reconciliation between PostgreSQL projections and TigerBeetle accounts passes.
4. Ambiguous command recovery can lookup transfer IDs in TigerBeetle.
5. Outbox emission remains PostgreSQL-owned and command-correlated.
6. Security owner confirms that clients cannot access TigerBeetle directly.
7. SRE confirms backup, restore, upgrade, monitoring, and incident runbooks.
8. Domain owner confirms account modeling for the ledger scope.
