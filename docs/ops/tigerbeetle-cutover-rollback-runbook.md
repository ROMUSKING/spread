---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP cutover prerequisite"
---

# Runbook: TigerBeetle Cutover and Rollback

## Purpose

Execute or reverse a scoped TigerBeetle cutover without pretending PostgreSQL and TigerBeetle are one distributed ACID transaction.

## Cutover preconditions

- Scope is exactly `(tenant_id, ledger_code)`.
- Model freeze is signed.
- Historical replay is complete or explicitly not required for the scope.
- Passive and strict shadow SLOs pass.
- Reconciliation has zero unresolved mismatches.
- Customer-support playbook exists for ambiguous ledger outcomes.
- Rollback window and support owner are documented.

## Cutover procedure

1. Announce cutover window and freeze schema changes for the scope.
2. Confirm no pending failed shadow jobs.
3. Set `numeric_ledger_catalog.authoritative_engine = 'tigerbeetle'`.
4. Set `numeric_ledger_migration_state.stage = 'cutover'`.
5. Route `NumericLedgerPort` to the TigerBeetle adapter for the scope.
6. Run a single command smoke test and command-status recovery test.
7. Run reconciliation immediately and on the normal schedule.

## Rollback posture

Rollback does not delete TigerBeetle transfers. TigerBeetle facts are immutable and must remain available for forensic reconciliation.

Rollback means:

1. Pause or throttle new commands for the affected scope if correctness is uncertain.
2. Route new commands back to `PostgresMvpNumericLedgerAdapter` only after owner sign-off.
3. Mark `numeric_ledger_migration_state.stage = 'rollback'`.
4. Keep TigerBeetle transfers as evidence.
5. Add correcting transfers if a business reversal is needed.
6. Rebuild PostgreSQL projections from the selected authoritative source.
7. Record the event in `docs/process/decision-waiver-log.md`.

## Required evidence

```text
ci://tests/ledger/cutover-scope-switch
ci://tests/ledger/post-cutover-pg-repair
ci://tests/ledger/rollback-stage-blocks-new-cutovers
```
