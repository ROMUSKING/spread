---
version: "0.12.4"
last-reviewed: "2026-06-26"
status: "tigerbeetle-ready numeric ledger refinement"
---

# CHANGELOG v0.12.4

## Added

- ADR-0019 selecting TigerBeetle as the post-MVP target numeric ledger plane.
- `docs/data/numeric-ledger-contract.md` with MVP ledger-shaped schema and compatibility rules.
- `docs/data/tigerbeetle-target-model.md` with post-MVP mapping for accounts, ledgers, and transfers.
- `docs/dev/numeric-ledger-plane.md` with `NumericLedgerPort` and adapter contract.
- `docs/gates/P1-LEDGER-001-tigerbeetle-numeric-ledger-spike.md`.
- `docs/diagrams/numeric-ledger-plane.md`.
- `docs/plan/post-mvp-tigerbeetle-transition.md`.
- `docs/qa/ledger-benchmark-plan.md`.
- Ledger invariants and test-manifest entries.
- Future migration path with model-freeze, historical-replay, passive-shadow, strict-shadow, cutover, reconciliation, and rollback stages.
- Post-cutover recovery flow for PostgreSQL projection/outbox repair after TigerBeetle ledger success.

## Changed

- Promoted the pack to v0.12.4.
- Updated pack index, onboarding, SLOs, tests, invariants, risk register, research basis, and validation script.
- Clarified that MVP remains PostgreSQL-backed but must avoid mutable numeric balance shortcuts for financial and stock movements.
- Added `transfer_payload_hash`, `balance_constraint`, `numeric_ledger_migration_state`, and group-transfer guidance to the MVP numeric ledger contract.
- Clarified that PostgreSQL remains the control plane and outbox/audit authority while TigerBeetle is the post-MVP numeric ledger plane target.

## Not changed

- TigerBeetle is not required on the MVP hot path.
- PostgreSQL outbox polling remains the Phase 0 live-update default.
- Domain authorization, workflow, tax, lot/serial, UOM, and compliance rules remain outside the numeric ledger plane.
