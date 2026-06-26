---
version: "0.12.6"
last-reviewed: "2026-06-26"
status: "review-response"
---

# Review Response v0.12.6 - TigerBeetle Field Policy Corrections

## Scope

This document records the response to the v0.12.5 TigerBeetle Field Policy Pack critical review. All critical and high-priority findings are addressed before P1-LEDGER-001 may open.

## Resolved findings

| Finding | Resolution | Primary files |
|---|---|---|
| CRIT-01 transfer ID derivation drift | `numeric-ledger-contract.md` is now the only authoritative source. Other docs point to it. Added uniqueness proof tests. | `docs/data/numeric-ledger-contract.md`, `docs/dev/numeric-ledger-plane.md`, ADR-0019/0020 |
| CRIT-02 `SMALLINT` too narrow for TigerBeetle `u16` code | Replaced TigerBeetle code mirrors with `INTEGER CHECK (1..65535)`. | `docs/data/tigerbeetle-field-assignment-policy.md` |
| CRIT-03 signed `INTEGER` too narrow for TigerBeetle `u32` ledger | Replaced TigerBeetle ledger mirrors with `BIGINT CHECK (1..4294967295)`. | `docs/data/tigerbeetle-field-assignment-policy.md`, `docs/data/numeric-ledger-contract.md` |
| HIGH-01 missing BENCH-LEDGER-003..007 manifest jobs | Added benchmark jobs and supporting CI URIs. | `tests/manifest.yml` |
| HIGH-02 orphaned BENCH-LEDGER-FIELD-001 | Added benchmark job to P1-LEDGER-001. | `tests/manifest.yml` |
| HIGH-03 duplicate spec field-policy section | Removed §21 and made §20.10 a pointer-only normative section. | `spec/...v0_12_6...md` |
| HIGH-04 duplicate gate numbering | Rewrote P1-LEDGER-001 requirements as a single numbered list. | `docs/gates/P1-LEDGER-001-tigerbeetle-numeric-ledger-spike.md` |
| HIGH-05 missing mirror self-transfer check | Added `CHECK (tb_debit_account_id <> tb_credit_account_id)`. | `docs/data/tigerbeetle-field-assignment-policy.md` |

## Medium fixes included

- Removed duplicate `## Field assignment policy` headings from numeric ledger and target model docs.
- Added reserved ID boundary checks for `tb_account_id`, `tb_transfer_id`, debit/credit account IDs, and pending IDs.
- Added pending-transfer lifecycle SLOs and benchmark requirements.
- Added `tigerbeetle_authoritative` transfer mirror state.
- Added same-ledger debit/credit enforcement CI.
- Added `LEDGER-005` for allowed-code and same-ledger account admission.
- Added explicit stock semantic compatibility rules for default UOM-ledger stock mode.
- Aligned migration-state vocabulary by adding `rollback` to the TigerBeetle ledger registry.

## Remaining posture

TigerBeetle remains a post-MVP target. MVP still implements PostgreSQL-backed `NumericLedgerPort`, but it now enforces TigerBeetle-compatible field widths, deterministic ID boundaries, mirror indexes, and stock compatibility guards so the later adapter transition does not become a domain rewrite.
