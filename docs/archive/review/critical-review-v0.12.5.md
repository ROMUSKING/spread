---
version: "0.12.5"
last-reviewed: "2026-06-26"
status: "field-assignment policy review"
---

# Critical Review v0.12.5 - TigerBeetle Field Assignment Policy

## Review focus

This review covers the new TigerBeetle indexed-field assignment policy and its integration into the MVP PostgreSQL numeric-ledger adapter, post-MVP TigerBeetle target model, P1-LEDGER evidence gate, and validation tooling.

## Verdict

The v0.12.5 field policy resolves the main remaining modeling ambiguity in the TigerBeetle transition plan. The chosen model is the highest-scored hybrid approach: dimension-centric accounts plus movement/document-centric transfers, with PostgreSQL retaining the rich semantic catalog and mirror indexes.

## Strengths

- Documents all evaluated field-assignment options instead of hiding rejected alternatives.
- Selects a clear default model with explicit account and transfer field meanings.
- Preserves deterministic command-derived transfer IDs for idempotency while avoiding raw `command_id` as default `Transfer.user_data_128`.
- Keeps `movement_group_id` as the business replay key for transfers.
- Adds PostgreSQL mirror schemas and indexes that align with TigerBeetle query-surface concepts.
- Defines stock default mode and strict SKU-ledger mode separately.
- Adds change-control rules for field-policy versions.

## Remaining risks

| Risk | Mitigation |
|---|---|
| Engineers may confuse command IDs, movement groups, and account dimension groups. | Keep examples in `docs/data/tigerbeetle-field-assignment-policy.md` and require support tooling to resolve compact fields. |
| Default stock UOM-ledger mode depends on domain validation to prevent cross-SKU mistakes. | Add explicit P1 tests for stock cross-SKU rejection and consider strict SKU-ledger mode for high-risk inventory. |
| Registry and mirror schemas add operational complexity. | Keep them PostgreSQL-owned in MVP and require migration rehearsal before strict shadow. |
| Packed-field pressure may reappear for performance reasons. | Require a separate ADR, cardinality proof, and support-tool decoding before any packed-bitfield exception. |

## Required follow-up evidence

```text
ci://tests/ledger/field-assignment-policy-registry-valid
ci://tests/ledger/tb-query-filter-mirror-indexes-present
ci://tests/ledger/tb-account-filter-mirror-indexes-present
ci://tests/ledger/hybrid-transfer-user-data-is-movement-group
ci://tests/ledger/account-user-data-is-dimension-group
ci://tests/ledger/stock-default-cross-sku-guard
ci://tests/ledger/transfer-payload-hash-conflict-detected
```

## Recommendation

Proceed with v0.12.5 as the TigerBeetle field-assignment baseline. Do not implement TigerBeetle runtime dependency in MVP; implement the PostgreSQL mirror and `NumericLedgerPort` so TigerBeetle adoption remains an adapter migration after MVP.
