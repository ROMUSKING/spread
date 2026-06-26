# CHANGELOG v0.12.5

**Date:** 2026-06-26  
**Status:** TigerBeetle field-assignment policy baseline  
**Supersedes:** v0.12.4 TigerBeetle-ready baseline

## Added

- Added `docs/data/tigerbeetle-field-assignment-policy.md`.
- Documented all considered TigerBeetle field assignment options:
  - hybrid dimension-centric accounts + movement-centric transfers,
  - entity-centric,
  - command-centric,
  - registry-key minimalism,
  - packed semantic bitfields,
  - ledger-heavy dimensional model,
  - strict SKU-ledger stock variant.
- Selected the highest-scored **hybrid model** as the accepted policy.
- Added PostgreSQL semantic index catalog tables:
  - `tb_field_assignment_policy`,
  - `tb_ledger_registry`,
  - `tb_code_registry`,
  - `tb_account_dimension_group`,
  - `tb_movement_group`,
  - `tb_account_registry`,
  - `tb_transfer_registry`.
- Added QueryFilter and AccountFilter mirror indexes for PostgreSQL.

## Updated

- Updated the normative spec with a TigerBeetle field-assignment section.
- Updated pack index and README to surface the policy as required reading for numeric ledger work.
- Updated the numeric ledger contract, target model, migration plan, ledger benchmark plan, and P1-LEDGER-001 gate to reference the policy.
- Updated tests manifest and validation script to require the new policy and mirror-index checks.

## Decision

Use the hybrid model:

```text
Account.user_data_128  -> account_dimension_group_id
Transfer.user_data_128 -> movement_group_id
ledger                 -> asset/unit universe
code                   -> account class or transfer reason
PostgreSQL             -> semantic index catalog and reporting/query plane
```

Strict SKU-ledger stock mode remains an optional controlled variant after P1-LEDGER-001 evidence and cardinality review.
