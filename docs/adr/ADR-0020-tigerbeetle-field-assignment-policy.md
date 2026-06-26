# ADR-0020: TigerBeetle Field Assignment Policy

**Version:** 0.13  
**Status:** Accepted policy for MVP ledger-shape and post-MVP TigerBeetle migration  
**Date:** 2026-06-26  
**Owner:** Domain Ledger Owner + Platform/SRE Owner  
**Related:** `docs/data/tigerbeetle-field-assignment-policy.md`, `docs/data/numeric-ledger-contract.md`, `docs/data/tigerbeetle-target-model.md`, `docs/plan/post-mvp-tigerbeetle-transition.md`

## Context

v0.13 selected TigerBeetle as the post-MVP numeric ledger plane and required MVP numeric movement to use a TigerBeetle-shaped `NumericLedgerPort`. That left one high-risk modeling decision unresolved: how ERP semantics map onto TigerBeetle's compact indexed field surface while keeping PostgreSQL indexes in sync.

TigerBeetle provides accounts, transfers, ledgers, compact `code` fields, application-defined `user_data_128`, `user_data_64`, and `user_data_32` fields, account filters, transfer/account query filters, and immutable transfer/account semantics. PostgreSQL remains the ERP control plane and rich semantic index catalog.

## Decision

Adopt the highest-scored hybrid model:

```text
Dimension-centric accounts + movement/document-centric transfers.
PostgreSQL owns semantic expansion and rich query indexes.
TigerBeetle owns numeric movement and ledger-native constraints after cutover.
```

The normative assignment is:

```text
Account.ledger        = tenant + asset/unit/scale ledger
Account.code          = account category/state
Account.user_data_128 = account_dimension_group_id
Account.user_data_64  = compact primary dimension or zero
Account.user_data_32  = compact site/location/jurisdiction bucket

Transfer.id           = canonical command-line transfer ID from docs/data/numeric-ledger-contract.md
Transfer.ledger       = same asset/unit/scale ledger
Transfer.code         = movement/posting reason
Transfer.user_data_128 = movement_group_id
Transfer.user_data_64  = effective/origin business timestamp or approved bucket
Transfer.user_data_32  = site/location/jurisdiction bucket
```

All meanings are versioned in `tb_field_assignment_policy`. PostgreSQL mirror tables must store the exact TigerBeetle indexed fields plus the semantic expansion required for ERP grid queries, recovery, reporting, and reconciliation.

## Alternatives considered

| Option | Overall score | Status |
|---|---:|---|
| Hybrid dimension accounts + movement transfers | 9.2 | Selected |
| Strict SKU-ledger stock variant | 8.2 | Optional after evidence |
| Registry-key minimalism | 7.8 | Fallback |
| Entity-centric everywhere | 7.4 | Rejected |
| Command-centric transfers | 7.0 direct; adopted through deterministic transfer IDs | Partially adopted |
| Packed semantic bitfields | 5.8 | Rejected |
| Ledger-heavy dimensional model | 4.5 | Rejected |

## Consequences

- PostgreSQL must include a field-assignment policy registry, ledger registry, code registry, account mirror, transfer mirror, and indexes that match TigerBeetle QueryFilter-like and AccountFilter-like access paths.
- `Transfer.user_data_128` uses `movement_group_id`, not raw `command_id`. Command identity remains in deterministic transfer IDs and PostgreSQL recovery indexes.
- The default stock model uses `tenant + UOM + scale` ledgers. `tenant + SKU + UOM + scale` ledgers are optional for high-risk stock classes after P1 evidence.
- Packed bitfields and ledger-heavy dimensional modeling are prohibited unless a future ADR proves bounded cardinality and migration safety.
- Field-assignment meaning may not change in place. New meaning requires a new policy version and reconciliation evidence.

## Required evidence

```text
ci://tests/ledger/field-assignment-policy-registry
ci://tests/ledger/postgres-mirror-index-sync
ci://tests/ledger/query-filter-mirror-indexes
ci://tests/ledger/account-filter-mirror-indexes
ci://tests/ledger/transfer-payload-hash-conflict
ci://tests/ledger/movement-group-replay
ci://tests/ledger/strict-sku-ledger-admission
```

## Non-goals

- Do not make TigerBeetle the ERP metadata store.
- Do not expose TigerBeetle IDs or clients directly to browsers.
- Do not use TigerBeetle fields as mutable workflow state.
- Do not use TigerBeetle for prices, rates, KPIs, forecasts, formula outputs, thresholds, or other non-conserved numeric attributes.


## v0.13 correction

The field assignment policy does not define `Transfer.id` hash inputs. It points to `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules` as the single authoritative derivation. This prevents adapter divergence between PostgreSQL MVP, TigerBeetle shadow, and post-cutover recovery implementations.
