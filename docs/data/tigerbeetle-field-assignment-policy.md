---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "normative field assignment policy"
owner: "Domain Ledger Owner"
links:
  - docs/adr/ADR-0020-tigerbeetle-field-assignment-policy.md
  - docs/data/numeric-ledger-contract.md
  - docs/data/tigerbeetle-target-model.md
  - docs/dev/numeric-ledger-plane.md
  - docs/plan/post-mvp-tigerbeetle-transition.md
---

# TigerBeetle Field Assignment Policy

## 1. Purpose

This document defines how the ERP maps business ledger semantics into TigerBeetle's indexed fields and how PostgreSQL mirrors those fields so both systems work together after the post-MVP TigerBeetle transition.

The chosen policy is the **highest-scored hybrid model**. Hybrid dimension-centric accounts plus movement-centric transfers is the chosen default:

```text
Dimension-centric accounts + movement/document-centric transfers,
with PostgreSQL holding the rich semantic index catalog.
```

This means TigerBeetle stores compact, immutable, queryable ledger facts. PostgreSQL stores business metadata, permissions, workflow, spreadsheet projections, semantic indexes, field-assignment policy versions, and reconciliation mirrors.

## 2. Normative decision

The field assignment for all MVP and post-MVP numeric-ledger work is:

| TigerBeetle field | Normative meaning |
|---|---|
| `id` | Immutable object identity and idempotency key. |
| `ledger` | Conserved asset/value universe. Usually tenant plus currency, unit, scale, or a selected strict SKU/unit scope. |
| `code` | Low-cardinality account class or transfer reason enum. |
| `user_data_128` | Primary external/group pointer into PostgreSQL. For accounts this is `account_dimension_group_id`; for transfers this is `movement_group_id`. |
| `user_data_64` | Effective/origin timestamp for transfers, or a compact high-value account dimension such as SKU, counterparty, project, or time bucket. |
| `user_data_32` | Small low-cardinality operational bucket such as site, warehouse, jurisdiction, region, legal entity, or status family. |
| `timestamp` | TigerBeetle acceptance/order timestamp, not business effective time. |

Normative line:

> TigerBeetle `user_data` fields are not the ERP dimensional model. They are compact indexed pointers into the PostgreSQL semantic index catalog.

## 3. TigerBeetle field facts used by this policy

The policy relies on these stable model facts from TigerBeetle documentation:

| Fact | Design implication |
|---|---|
| `ledger`, `code`, and `user_data_128/64/32` are compact fields available on accounts and transfers. | Keep them stable and low-ambiguity; do not encode large mutable business objects directly. |
| `QueryFilter` can filter accounts or transfers by `user_data_128`, `user_data_64`, `user_data_32`, `ledger`, `code`, and timestamp range. | PostgreSQL mirrors these exact fields and builds matching indexes for reconciliation and diagnostics. |
| `AccountFilter` queries transfers for one account and can filter by transfer `user_data_*`, `code`, timestamp, and debit/credit side. | PostgreSQL keeps debit-account and credit-account indexes that mirror the TigerBeetle account history access path. |
| A TigerBeetle transfer debits one account and credits one account on the same ledger. | Do not over-partition `ledger`; transfers that should be allowed must remain inside the same ledger. |
| Transfers are immutable once created. | Corrections are new transfers; mutable business state belongs in PostgreSQL. |
| TigerBeetle is not a general-purpose database. | PostgreSQL remains the semantic catalog, grid query engine, permission store, workflow store, audit/outbox owner, and reporting projection store. |

Primary reference URLs:

- <https://docs.tigerbeetle.com/coding/data-modeling/>
- <https://docs.tigerbeetle.com/coding/system-architecture/>
- <https://docs.tigerbeetle.com/concepts/debit-credit/>
- <https://docs.tigerbeetle.com/reference/query-filter/>
- <https://docs.tigerbeetle.com/reference/account-filter/>
- <https://docs.tigerbeetle.com/reference/account/>
- <https://docs.tigerbeetle.com/reference/transfer/>
- <https://docs.tigerbeetle.com/reference/requests/create_transfers/>

## 4. Assignment principles

### 4.1 Keep the ledger field narrow but not over-dimensional

Use `ledger` for the conserved asset/value universe.

Good examples:

```text
financial: tenant + currency + scale
stock default: tenant + stock unit/UOM + scale
stock strict: tenant + SKU + UOM + scale, only when cardinality is safe
quota/capacity: tenant + unit + scale
```

Avoid:

```text
tenant + SKU + warehouse + lot + bin + status
```

That over-partitions the ledger and can make legitimate transfers impossible or awkward.

### 4.2 Use code for enums only

`code` is not an entity ID. It is a small stable enum.

Good examples:

```text
Account.code: cash, accounts_receivable, stock_available, stock_reserved, stock_quarantine
Transfer.code: invoice_post, payment_received, stock_receive, stock_reserve, stock_ship
```

Avoid:

```text
code = customer_id
code = SKU id
code = warehouse_id
code = workflow_state
```

### 4.3 Prefer PostgreSQL semantic registries over packed bitfields

Do not pack too many business dimensions into `user_data_128`. Use a PostgreSQL row as the semantic registry and put its stable unsigned 128-bit pointer into TigerBeetle.

### 4.4 Do not store mutable workflow state in immutable account fields

TigerBeetle accounts are not the workflow model. If an object moves from `draft` to `approved`, PostgreSQL records the workflow state. If stock moves from `available` to `reserved`, that is a transfer between state-specific accounts or a pending-transfer lifecycle.

### 4.5 Mirror the TigerBeetle query surface in PostgreSQL

For every account and transfer, PostgreSQL stores:

```text
id
ledger
code
user_data_128
user_data_64
user_data_32
timestamp after creation
flags
amount for transfers
debit_account_id and credit_account_id for transfers
pending_id for transfers
field_assignment_policy_version
transfer_payload_hash for transfers
```

This makes PostgreSQL capable of:

- diagnosing TigerBeetle query results,
- replaying migration imports,
- reconciling projections,
- serving grid/reporting queries,
- validating shadow-mode field assignments,
- explaining ledger movements to support and audit users.

## 5. Evaluated options

### 5.1 Option A: Hybrid dimension-centric accounts and movement-centric transfers

**Decision:** selected.

| Account field | Assignment |
|---|---|
| `Account.id` | Stable account ID for a specific numeric account. |
| `Account.ledger` | Tenant plus asset/unit/scale ledger ID from PostgreSQL registry. |
| `Account.code` | Account class/state enum. |
| `Account.user_data_128` | `account_dimension_group_id`. |
| `Account.user_data_64` | Primary compact dimension: SKU, counterparty, project, or time bucket. |
| `Account.user_data_32` | Site, warehouse, jurisdiction, legal entity, region, or status family. |

| Transfer field | Assignment |
|---|---|
| `Transfer.id` | Canonical deterministic ID defined only in `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules`. |
| `Transfer.ledger` | Same asset/unit/scale ledger as debit and credit accounts. |
| `Transfer.code` | Movement/posting reason enum. |
| `Transfer.user_data_128` | `movement_group_id`: invoice posting, shipment, receipt, reservation, adjustment, allocation, etc. |
| `Transfer.user_data_64` | Effective/origin business timestamp in nanoseconds, or approved domain-specific time bucket. |
| `Transfer.user_data_32` | Site, warehouse, jurisdiction, legal entity, or region bucket. |

Strengths:

- Best balance between TigerBeetle-native lookup and PostgreSQL semantic richness.
- Natural command recovery because `Transfer.id` uses the canonical deterministic derivation in `docs/data/numeric-ledger-contract.md`.
- Natural document and movement replay because `Transfer.user_data_128` groups the business movement.
- Suitable for finance, stock, reservations, credits, quotas, and capacity.
- Minimizes future migration work because MVP PostgreSQL fields mirror TigerBeetle fields.

Weaknesses:

- Requires a PostgreSQL semantic registry and field-assignment policy versioning.
- Requires careful account-dimension design before broad stock use.
- Requires support tooling to explain compact integer fields.

Score: **9.2 / 10**.

### 5.2 Option B: Entity-centric accounts and transfers

| Field family | Assignment |
|---|---|
| `Account.user_data_128` | Customer, supplier, SKU, warehouse, project, or other primary business entity. |
| `Transfer.user_data_128` | Same primary entity. |
| `Transfer.user_data_64` | Effective timestamp. |
| `Transfer.user_data_32` | Location or jurisdiction. |

Strengths:

- Simple to understand.
- Good for entity-history queries such as all movements for SKU X or customer Y.
- Low initial cognitive load.

Weaknesses:

- Weak for multi-leg events where several entities participate.
- Less natural for invoice, shipment, manufacturing, and payment-allocation replay.
- Pushes movement grouping back into PostgreSQL for many audit workflows.

Score: **7.4 / 10**.

Disposition: rejected as the default, but some ledgers may use entity compact IDs in `Account.user_data_64` under the hybrid policy.

### 5.3 Option C: Command-centric transfers

| Field family | Assignment |
|---|---|
| `Transfer.id` | Canonical deterministic ID defined only in `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules`. |
| `Transfer.user_data_128` | Raw command ID or command group ID. |
| `Transfer.user_data_64` | Effective timestamp. |
| `Transfer.user_data_32` | Site or location. |

Strengths:

- Strong command recovery.
- Easy mapping from command log to ledger effects.
- Good for ambiguous-response repair.

Weaknesses:

- A command is not always the right business grouping.
- Some commands create multiple documents or movement groups.
- Business reconciliation is more natural around posting groups, invoices, receipts, shipments, reservations, and adjustments than raw commands.

Score: **7.0 / 10** as a standalone model.

Disposition: folded into the hybrid model. `Transfer.id` follows the canonical ID derivation contract, while `Transfer.user_data_128` is the business `movement_group_id`.

### 5.4 Option D: Registry-key minimalism

| Field family | Assignment |
|---|---|
| `user_data_128` | Opaque PostgreSQL registry key. |
| `user_data_64` | Zero or registry bucket. |
| `user_data_32` | Zero or registry bucket. |
| `ledger` | Registry-driven ledger ID. |
| `code` | Registry-driven code ID. |

Strengths:

- Very flexible.
- Preserves PostgreSQL as the sole semantic source.
- Safe fallback when ledger dimensions are still unstable.

Weaknesses:

- Underuses TigerBeetle's indexed fields.
- Less useful for TigerBeetle-side diagnostics and reconciliation.
- More PostgreSQL lookups needed for routine ledger analysis.

Score: **7.8 / 10**.

Disposition: allowed as a temporary migration fallback for unstable ledger families, not the preferred policy.

### 5.5 Option E: Packed semantic bitfields

Example:

```text
user_data_128 = tenant_short_id + sku_short_id + warehouse_short_id + lot_short_id + status_code
```

Strengths:

- Dense and sometimes fast.
- Can reduce registry joins for very narrow use cases.

Weaknesses:

- Hard to evolve.
- Hard to debug.
- Depends on cardinality assumptions that may fail.
- Couples TigerBeetle immutable fields to ERP domain changes.
- Makes migration and support explanations harder.

Score: **5.8 / 10**.

Disposition: rejected for general use. Packed fields require separate ADR approval and a cardinality proof.

### 5.6 Option F: Ledger-heavy dimensional model

Example:

```text
ledger = tenant + SKU + warehouse + lot + bin + status
```

Strengths:

- Strong local conservation within a very narrow ledger.
- Some incorrect cross-dimension transfers become impossible by construction.

Weaknesses:

- Over-fragments the ledger namespace.
- Legitimate warehouse, lot, status, and manufacturing movements become cross-ledger events.
- Operational moves become more complex than the business process.
- Cardinality and registry pressure rise quickly.

Score: **4.5 / 10**.

Disposition: rejected as a general model.

### 5.7 Option G: Strict SKU-ledger stock model

| Field family | Assignment |
|---|---|
| `ledger` | Tenant + SKU + UOM + scale. |
| `Account.user_data_128` | Location, lot, serial, and status dimension group. |
| `Account.user_data_64` | Warehouse or bin compact key. |
| `Account.user_data_32` | Site or status-family code. |
| `Transfer.user_data_128` | Movement group. |

Strengths:

- Stronger storage-level SKU conservation.
- Reduces risk of cross-SKU transfer mistakes.
- Useful for high-value, regulated, or low-cardinality inventory.

Weaknesses:

- Higher ledger cardinality.
- More complex for manufacturing, substitutions, SKU merges, and UOM transforms.
- Requires cardinality review and migration rehearsal.

Score: **8.2 / 10 overall; 9.0 / 10 for high-risk inventory classes**.

Disposition: accepted as an optional strict mode after P1-LEDGER-001 evidence. It is not the default stock model.


### 5.8 Option H: Warehouse-SKU-status ledger model

Example:

```text
ledger = tenant + warehouse + SKU + UOM + stock_status
```

Strengths:

- Strong local conservation within one warehouse/SKU/status bucket.
- Easy to reason about for a very small single-warehouse deployment.

Weaknesses:

- Warehouse-to-warehouse moves become cross-ledger events.
- Available-to-reserved transitions can become cross-ledger events if status is included in the ledger.
- Bin, lot, quality, and manufacturing flows become unnecessarily complex.
- Ledger cardinality grows faster than the business value of the constraint.

Score: **3.8 / 10**.

Disposition: rejected. Warehouse, lot, bin, and stock status belong in account dimensions and PostgreSQL semantic indexes, not in the default `ledger` field.

## 6. Scoring summary

| Strategy | Safety | Query usefulness | Migration ease | Cognitive load | Overall |
|---|---:|---:|---:|---:|---:|
| Hybrid: dimension accounts + movement transfers | 9 | 9 | 9 | 8 | **9.2** |
| Strict SKU-ledger variant | 10 | 8 | 7 | 7 | **8.2** |
| Registry-key minimalism | 8 | 6 | 9 | 8 | **7.8** |
| Entity-centric everywhere | 7 | 8 | 7 | 8 | **7.4** |
| Command-centric transfers only | 8 | 6 | 8 | 7 | **7.0** |
| Packed semantic bitfields | 6 | 8 | 4 | 5 | **5.8** |
| Ledger-heavy dimensional model | 7 | 5 | 3 | 4 | **4.5** |
| Warehouse-SKU-status ledger model | 6 | 4 | 3 | 3 | **3.8** |

Selected default: **hybrid model**.

## 7. Final account assignment

| Field | Final assignment |
|---|---|
| `Account.id` | `tb_account_id`, stable unsigned 128-bit account ID. |
| `Account.ledger` | `tb_ledger_id`, tenant plus asset/unit/scale ledger from PostgreSQL registry. |
| `Account.code` | Account category or state enum from `tb_code_registry`. |
| `Account.user_data_128` | `account_dimension_group_id_u128`, pointing to PostgreSQL account-dimension registry. |
| `Account.user_data_64` | Domain-specific compact primary dimension. Financial: counterparty, cost center, project, or zero. Stock: SKU compact ID. Capacity: resource or time bucket. |
| `Account.user_data_32` | Compact site, warehouse, jurisdiction, legal entity, region, or status-family code. |
| `Account.flags` | Target balance constraints, history, linked/imported flags where required. |
| `Account.timestamp` | TigerBeetle account creation timestamp after creation. |

## 8. Final transfer assignment

| Field | Final assignment |
|---|---|
| `Transfer.id` | Canonical deterministic ID defined only in `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules`. |
| `Transfer.debit_account_id` | Source/debit account. |
| `Transfer.credit_account_id` | Destination/credit account. |
| `Transfer.amount` | Unsigned fixed-scale integer amount. |
| `Transfer.pending_id` | Pending transfer lifecycle pointer for holds/reservations. |
| `Transfer.ledger` | Same asset/unit/scale ledger as debit and credit accounts. |
| `Transfer.code` | Movement/posting reason enum from `tb_code_registry`. |
| `Transfer.user_data_128` | `movement_group_id_u128`: document/posting/receipt/shipment/reservation/adjustment group. |
| `Transfer.user_data_64` | Business effective/origin timestamp in nanoseconds unless the ledger-family policy approves another compact time bucket. |
| `Transfer.user_data_32` | Site, warehouse, jurisdiction, legal entity, or region bucket. |
| `Transfer.flags` | Pending, post-pending, void-pending, linked, balancing, closing, imported, or domain-approved flags. |
| `Transfer.timestamp` | TigerBeetle acceptance timestamp after creation. |

`Transfer.id` derivation is intentionally pointer-only here. The single normative hash-input list is in `docs/data/numeric-ledger-contract.md#authoritative-transfer-id-derivation`.

## 9. Domain-specific assignments

### 9.1 Financial ledgers

| Field | Financial assignment |
|---|---|
| `ledger` | Tenant + currency + scale. |
| `Account.code` | Cash, AR, AP, revenue, expense, liability, equity, clearing, tax, suspense. |
| `Transfer.code` | Invoice post, payment received, refund, adjustment, tax posting, reclassification, correction. |
| `Account.user_data_128` | Account dimension group: legal entity, natural account, counterparty, cost center, project. |
| `Account.user_data_64` | Counterparty, project, cost-center compact ID, or zero. |
| `Account.user_data_32` | Jurisdiction, legal entity, or region code. |
| `Transfer.user_data_128` | Posting group or document movement group. |
| `Transfer.user_data_64` | Accounting effective timestamp. |
| `Transfer.user_data_32` | Jurisdiction or legal entity code. |

### 9.2 Stock ledgers, default mode

| Field | Stock default assignment |
|---|---|
| `ledger` | Tenant + stock unit/UOM + scale. |
| `Account.code` | Available, reserved, quarantine, damaged, in transit, shipped, consumed, adjustment. |
| `Transfer.code` | Receive, reserve, release, ship, move, quarantine, adjust gain, adjust loss, consume, produce. |
| `Account.user_data_128` | SKU, warehouse, bin, lot, serial, and status dimension group. |
| `Account.user_data_64` | SKU compact ID. |
| `Account.user_data_32` | Warehouse or site compact code. |
| `Transfer.user_data_128` | Stock movement group: receipt, reservation, shipment, adjustment, transfer order, work order. |
| `Transfer.user_data_64` | Effective movement timestamp. |
| `Transfer.user_data_32` | Warehouse or site compact code. |

Default stock mode depends on domain validation to prevent incorrect cross-SKU transfers. PostgreSQL account registry and command handlers must validate that stock transfer source and destination dimensions are semantically compatible.

Normative default-stock compatibility rule:

```text
For ledger_granularity = tenant_uom:
  source.sku_id must equal destination.sku_id
  source.uom_code must equal destination.uom_code
  lot/serial dimensions must be equal unless the movement code is explicitly lot/serial-transforming
  status transitions must be allowed by tb_stock_status_transition_policy
  warehouse/bin changes are allowed only for movement codes in the stock_move family
```

Required tests:

```text
ci://tests/ledger/stock-default-semantic-compatibility
ci://tests/ledger/stock-default-cross-sku-guard
```


### 9.3 Stock ledgers, strict SKU mode

Strict mode may be selected for high-risk inventory after P1-LEDGER-001.

| Field | Strict stock assignment |
|---|---|
| `ledger` | Tenant + SKU + UOM + scale. |
| `Account.code` | Available, reserved, quarantine, damaged, in transit, shipped, consumed, adjustment. |
| `Account.user_data_128` | Location, bin, lot, serial, and status dimension group. |
| `Account.user_data_64` | Warehouse/bin compact key. |
| `Account.user_data_32` | Site or status-family code. |
| `Transfer.user_data_128` | Movement group. |
| `Transfer.user_data_64` | Effective movement timestamp. |
| `Transfer.user_data_32` | Site or warehouse code. |

### 9.4 Reservations and holds

| Field | Reservation assignment |
|---|---|
| `ledger` | Same asset/unit ledger as the underlying quantity. |
| `Account.code` | Available, reserved, held, released, consumed. |
| `Transfer.code` | Reserve, post reservation, void reservation, release, expire. |
| `Transfer.pending_id` | Pending transfer being posted or voided. |
| `Transfer.user_data_128` | Reservation group, order group, or allocation group. |
| `Transfer.user_data_64` | Reservation effective timestamp or expiry bucket. |
| `Transfer.user_data_32` | Site or location bucket. |

### 9.5 Quotas, capacity, credits, and points

| Field | Assignment |
|---|---|
| `ledger` | Tenant + unit + scale. |
| `Account.code` | Available, reserved, consumed, expired, adjustment. |
| `Transfer.code` | Allocate, reserve, consume, release, expire, correct. |
| `Account.user_data_128` | Resource, project, user, customer, or program dimension group. |
| `Account.user_data_64` | Time bucket, resource compact ID, or customer compact ID. |
| `Account.user_data_32` | Region, site, class, or program code. |
| `Transfer.user_data_128` | Allocation, booking, consumption, or credit movement group. |
| `Transfer.user_data_64` | Effective timestamp or window bucket. |
| `Transfer.user_data_32` | Region, site, class, or program code. |

## 10. PostgreSQL mirror schema reference

The canonical DDL for TigerBeetle mirror registries and indexes lives in `docs/data/numeric-ledger-contract.md#post-mvp-tigerbeetle-mirror-registry-schema`. This policy owns field meanings and evaluated assignment options only; it must not duplicate `CREATE TABLE` blocks.

Canonical tables:

```text
tb_field_assignment_policy
tb_ledger_registry
tb_stock_status_transition_policy
tb_code_registry
tb_account_registry
tb_transfer_registry
```

Canonical mirror indexes include:

```text
ix_tb_accounts_qf_ledger_code_udata
ix_tb_transfers_qf_ledger_code_udata_time
ix_tb_transfers_debit_account_time
ix_tb_transfers_credit_account_time
```

## 11. PostgreSQL indexes that mirror TigerBeetle access paths

Index names and DDL are canonical in `docs/data/numeric-ledger-contract.md#post-mvp-tigerbeetle-mirror-registry-schema`. The policy requirement is semantic: PostgreSQL must mirror the TigerBeetle QueryFilter and AccountFilter access surface exactly enough for shadow comparison, cutover verification, and support tooling.


### 12.1 Exact field mirror

For every TigerBeetle account or transfer created, imported, shadowed, or planned, PostgreSQL must store the exact TigerBeetle fields plus the field-assignment policy version used to derive them.

### 12.2 Payload hash requirement

Every transfer mirror row stores a canonical `transfer_payload_hash` over:

```text
id
debit_account_id
credit_account_id
amount
pending_id
ledger
code
user_data_128
user_data_64
user_data_32
flags
timeout
```

A duplicate transfer ID with the same payload hash is idempotent success. A duplicate transfer ID with a different payload hash is a release-blocking corruption event.

### 12.3 Timestamp separation

Use TigerBeetle `timestamp` for ledger acceptance order. Use PostgreSQL `effective_at`, `origin_event_at`, or transfer `user_data_64` for business/economic time.

### 12.4 Policy version immutability

A policy version may be deprecated but not edited in place after production transfers exist. A new assignment requires a new `policy_version` and a migration/reconciliation plan.

### 12.4a Same-ledger debit/credit enforcement

Every planned transfer must verify that the debit and credit accounts resolve to the same `tb_ledger_id` before submission. PostgreSQL mirror rows must reject self-transfers and test cross-ledger rejection with `ci://tests/ledger/same-ledger-debit-credit-enforcement`. TigerBeetle will also reject cross-ledger transfers, but the ERP adapter must fail earlier with a domain-readable error.

### 12.4b MVP code admission

`tb_code_registry.allowed_in_mvp` is normative. MVP command handlers and adapters may use only codes where `allowed_in_mvp = true` for the active ledger family. This is enforced by `LEDGER-005` and `ci://tests/ledger/mvp-command-uses-only-allowed-codes`.

### 12.4c Default stock cross-SKU compatibility rule

Default stock mode uses `ledger = tenant + stock unit/UOM + scale`; therefore it does not structurally prevent cross-SKU transfers. The stock command handler must verify semantic compatibility before calling `NumericLedgerPort`:

```text
source.sku_id == destination.sku_id
source.uom_code == destination.uom_code
source.tenant_id == destination.tenant_id
source.stock_status transition is allowed by the stock-state transition table
lot/serial compatibility passes for lot- or serial-controlled SKUs
warehouse/bin movement policy permits the source -> destination route
```

A transfer that intentionally changes SKU identity, such as manufacturing transformation, substitution, kit assembly, or UOM conversion, must use an explicit domain command and a distinct movement kind with its own fixtures. Generic stock receive/reserve/ship/move/adjust commands must not perform implicit cross-SKU movement.

### 12.5 Support and audit explanation

Support tools must be able to resolve:

```text
tb_ledger_id -> tenant, ledger family, asset, scale, granularity
tb_code -> account class or transfer reason
tb_user_data_128 -> account dimension group or movement group
tb_user_data_64 -> timestamp or compact dimension meaning
tb_user_data_32 -> site/location/jurisdiction meaning
```

## 13. Migration compatibility checklist

Before a ledger can enter `passive_shadow`:

1. `tb_field_assignment_policy` has rows for account and transfer objects.
2. `tb_ledger_registry` covers every selected MVP ledger.
3. `tb_code_registry` contains all account and transfer codes used by the selected ledger family.
4. Every MVP account has a deterministic or registered `tb_account_id`.
5. Every MVP transfer has a deterministic `tb_transfer_id` and `transfer_payload_hash`.
6. PostgreSQL mirror indexes exist and are included in schema tests.
7. Shadow posting writes the same field values as historical replay.
8. Reconciliation can compare PostgreSQL projections to TigerBeetle account balances.
9. Support tooling can explain all compact fields.
10. Field policy owner, domain owner, SRE, and security owner sign the selected policy version.

## 14. Rejected shortcuts

These are prohibited without a signed ADR and dedicated gate:

- Using `ledger` for tenant + SKU + warehouse + lot + bin + status by default.
- Storing customer, supplier, SKU, or warehouse IDs in `code`.
- Changing `user_data_*` semantics without a new policy version.
- Using TigerBeetle `timestamp` as invoice date, shipment date, or accounting effective date.
- Omitting PostgreSQL mirror fields because the value is already in TigerBeetle.
- Allowing spreadsheet formulas to directly create ledger transfers.
- Storing mutable workflow state in account `user_data_*` fields.
- Using packed bitfields without cardinality proof and support-tool decoding.

## 15. Owner sign-off

| Role | Required sign-off |
|---|---|
| Domain Ledger Owner | Confirms ledgerability and business semantics. |
| Backend Owner | Confirms adapter and deterministic ID compatibility. |
| SRE Owner | Confirms index, migration, reconciliation, and operational readiness. |
| Security Owner | Confirms clients cannot directly access TigerBeetle and fields do not leak sensitive data. |
| Compliance Owner | Confirms audit/explanation requirements for financial and regulated stock ledgers. |

## 16. Final decision statement

The ERP will use the **hybrid TigerBeetle field assignment model** for all post-MVP numeric ledger planning and for MVP PostgreSQL mirror fields:

```text
Accounts describe stable balance-holding dimensions.
Transfers describe immutable movement groups.
PostgreSQL stores the rich semantic catalog and mirrors TigerBeetle's indexed query surface.
```
