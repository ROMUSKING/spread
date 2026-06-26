# Review Response: v0.12.6 TigerBeetle Field-Policy Hardening

**Source review:** External critical review of v0.12.5 TigerBeetle Field Policy Pack.  
**Status:** Addressed in v0.12.6.

## Critical fixes

| Review item | Resolution |
|---|---|
| CRIT-01 inconsistent transfer ID inputs | `docs/data/numeric-ledger-contract.md` is now the only normative source. Other docs point to it. Required unique proof is `UNIQUE (tenant_id, command_id, command_line_index, movement_kind)`. |
| CRIT-02 `SMALLINT` too narrow for TigerBeetle `u16` code | Mirror code fields now use `INTEGER CHECK (>= 1 AND <= 65535)`. |
| CRIT-03 `INTEGER` too narrow for TigerBeetle `u32` ledger | Mirror ledger fields now use `BIGINT CHECK (> 0 AND <= 4294967295)`. |

## High-priority fixes

| Review item | Resolution |
|---|---|
| HIGH-01 BENCH-LEDGER-003 through 007 absent from manifest | Added all five CI benchmark entries to P1-LEDGER-001. |
| HIGH-02 BENCH-LEDGER-FIELD-001 orphaned | Added to P1-LEDGER-001 CI jobs. |
| HIGH-03 duplicate spec field-policy sections | Removed spec section 21 and made section 20.10 pointer-only. |
| HIGH-04 duplicate gate numbering | Rewrote P1-LEDGER-001 requirements with unique numbering. |
| HIGH-05 missing debit/credit self-transfer check | Added `CHECK (tb_debit_account_id <> tb_credit_account_id)` to mirror DDL. |

## Medium/minor fixes

- Merged duplicate `## Field assignment policy` headings.
- Added reserved `u128` ID boundary checks.
- Added pending transfer lifecycle SLOs.
- Added `tigerbeetle_authoritative` transfer mirror state.
- Added same-ledger debit/credit CI evidence.
- Added `LEDGER-005` for `allowed_in_mvp` code enforcement.
- Added explicit default-stock semantic compatibility requirements.
- Aligned migration state vocabulary with `rollback`.
- Added exact `transfer-payload-hash-conflict-detected` manifest URI.

## Remaining posture

The chosen field assignment remains the highest-scored hybrid model: dimension-centric accounts plus movement/document-centric transfers, with PostgreSQL as semantic catalog and TigerBeetle as the future numeric ledger plane.
