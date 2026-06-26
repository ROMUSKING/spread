# CHANGELOG v0.12.6

**Date:** 2026-06-26  
**Status:** TigerBeetle field-policy hardening baseline

## Fixed

- Canonicalized deterministic `Transfer.id` derivation in `docs/data/numeric-ledger-contract.md`.
- Converted TigerBeetle `code` mirror columns from PostgreSQL `SMALLINT` to `INTEGER CHECK (1..65535)`.
- Converted TigerBeetle `ledger` mirror columns from PostgreSQL signed `INTEGER` to `BIGINT CHECK (1..4294967295)`.
- Added reserved `u128` object-ID boundary checks to mirror registry DDL.
- Added `CHECK (tb_debit_account_id <> tb_credit_account_id)` to `tb_transfer_registry`.
- Added `tigerbeetle_authoritative` to transfer mirror submission states.
- Added BENCH-LEDGER-003 through BENCH-LEDGER-007 and BENCH-LEDGER-FIELD-001 to the P1-LEDGER-001 manifest.
- Removed duplicate TigerBeetle field-assignment section from the main spec.
- Merged duplicate field-assignment headings in the numeric ledger contract and TigerBeetle target model.
- Added default stock semantic-compatibility rules and CI evidence.
- Added MVP allowed-code invariant `LEDGER-005` and stock compatibility invariant `LEDGER-006`.

## Result

P1-LEDGER-001 now has consistent deterministic IDs, unsigned-compatible PostgreSQL mirrors, complete benchmark wiring, and explicit stock/default-code safety checks.
