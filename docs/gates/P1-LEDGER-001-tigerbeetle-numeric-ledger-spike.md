# P1-LEDGER-001: TigerBeetle Numeric Ledger Plane Spike

**Version:** 0.17.0  
**Owner:** Domain Ledger Owner + Platform/SRE Owner  
**Waiver:** Allowed for MVP runtime dependency only. MVP ledger-shaped contract is not waivable.  
**Normative spec:** v0.17.0 post-MVP sections 20  
**SLO reference:** `docs/slo-baseline.yml#benchmarks.BENCH-LEDGER-001`

## Purpose

Prove whether TigerBeetle should become the post-MVP authoritative numeric ledger plane for financial, stock, and other conserved numeric movement.

## Requirements

1. MVP implements `NumericLedgerPort` with PostgreSQL backing before broad financial or stock features.
2. Financial postings and stock receive/reserve/ship/adjust flows are represented as deterministic debit/credit transfers.
3. Account IDs and transfer IDs are future-compatible unsigned 128-bit decimal strings.
4. `Transfer.id` derivation is canonicalized in `docs/data/numeric-ledger-contract.md`; no gate/ADR/spec text may redefine its input tuple.
5. PostgreSQL balance projections are rebuildable from `numeric_transfers`.
6. Account constraints in the PostgreSQL adapter match the target TigerBeetle account-flag semantics.
7. A TigerBeetle adapter prototype uses the same domain movement plan and deterministic IDs.
8. Unknown-outcome recovery can lookup deterministic transfer IDs.
9. Historical replay imports MVP accounts/transfers into a shadow TigerBeetle cluster.
10. Passive shadow mode compares PostgreSQL MVP projection balances with TigerBeetle account balances.
11. Strict shadow mode runs for the approved soak period before any cutover.
12. Outbox/SSE delivery remains PostgreSQL-owned and command-correlated.
13. Security review confirms no browser or untrusted service can reach TigerBeetle directly.
14. Field assignment policy registry exists for each active ledger family.
15. PostgreSQL mirror tables store TigerBeetle QueryFilter-like and AccountFilter-like indexed fields using full unsigned-compatible ranges.
16. Hybrid model is used by default; strict SKU-ledger variant requires cardinality and reconciliation evidence.
17. MVP command handlers may use only `tb_code_registry.allowed_in_mvp = true` account/transfer codes.
18. Default stock mode must enforce semantic compatibility for same-ledger, same-UOM, same-SKU movement unless an approved transformation rule exists.
19. Cutover decision is explicit: finance only, finance plus stock, selected numeric ledgers, or defer.

## Evidence

```text
ci://tests/ledger/deterministic-transfer-id
ci://tests/ledger/deterministic-transfer-id-canonical-inputs
ci://tests/ledger/unique-command-line-movement-kind
ci://tests/ledger/projection-rebuild-from-transfers
ci://tests/ledger/financial-balanced-posting-flow
ci://tests/ledger/stock-available-reserved-shipped-flow
ci://tests/ledger/account-constraint-enforcement
ci://tests/ledger/ambiguous-command-lookup-by-transfer-id
ci://tests/ledger/tigerbeetle-account-import
ci://tests/ledger/tigerbeetle-transfer-replay
ci://tests/ledger/tb-code-u16-range
ci://tests/ledger/tb-ledger-u32-range
ci://tests/ledger/tb-registry-id-reserved-boundaries
ci://tests/ledger/same-ledger-debit-credit-enforcement
ci://tests/ledger/mvp-command-uses-only-allowed-codes
ci://tests/ledger/stock-default-semantic-compatibility
ci://tests/ledger/stock-default-cross-sku-guard
ci://tests/ledger/transfer-payload-hash-conflict-detected
ci://benchmarks/BENCH-LEDGER-001
ci://benchmarks/BENCH-LEDGER-002
ci://benchmarks/BENCH-LEDGER-003
ci://benchmarks/BENCH-LEDGER-004
ci://benchmarks/BENCH-LEDGER-005
ci://benchmarks/BENCH-LEDGER-006
ci://benchmarks/BENCH-LEDGER-007
ci://benchmarks/BENCH-LEDGER-FIELD-001
ci://reports/reconciliation/ledger-shadow-mode
ci://tests/ledger/post-cutover-pg-repair-after-ledger-success
ci://tests/ledger/field-assignment-policy-registry
ci://tests/ledger/postgres-mirror-index-sync
ci://tests/ledger/query-filter-mirror-indexes
ci://tests/ledger/account-filter-mirror-indexes
ci://tests/ledger/movement-group-replay
```

## Exit decision

```text
A. Adopt TigerBeetle for financial ledger only.
B. Adopt TigerBeetle for financial and stock ledgers.
C. Adopt TigerBeetle for selected numeric ledgers after more evidence.
D. Defer TigerBeetle beyond next release.
```

## Blocking conditions

- Any conserved numeric movement bypasses `NumericLedgerPort`.
- Transfer IDs are not deterministic or do not use the canonical derivation.
- Balances cannot be rebuilt from append-only movement records.
- TigerBeetle adapter requires domain command handlers to change semantics.
- Outbox or audit correlation is lost during ledger posting.
- Shadow mode produces unresolved balance mismatch.
- MVP command handlers use disallowed ledger codes.
- Default stock mode permits cross-SKU movement without an approved transformation rule.
- Rollback and correction posture is not signed.

## Field assignment policy

TigerBeetle `ledger`, `code`, and `user_data_*` assignments are governed by `docs/data/tigerbeetle-field-assignment-policy.md`. The accepted model is hybrid: dimension-centric accounts plus movement-group-centric transfers, with PostgreSQL as the semantic index catalog.

## v0.13 implementation-readiness additions

P1-LEDGER-001 may not open until the following are true:

1. `docs/data/numeric-ledger-contract.md` is the only authoritative source for deterministic account/transfer ID derivation.
2. TypeScript test vectors for SHA-256/128 ID derivation pass in both PostgreSQL MVP and TigerBeetle shadow adapters.
3. Fuzz/parity tests cover at least one million valid ID tuples before production cutover.
4. Shadow mode reports `ledger_shadow_lag_p99_s`, `ledger_reconciliation_p99_s`, and mismatch count.
5. The replay window is explicitly selected for the cutover scope before `historical_replay`.
6. High-cardinality stock fixtures prove default stock-mode semantic compatibility before stock cutover is considered.
7. TigerBeetle shadow worker, reconciliation, and cutover/rollback runbooks exist before production cutover.

Additional evidence:

```text
ci://tests/ledger/id-derivation-test-vectors
ci://tests/ledger/id-derivation-fuzz-1m
ci://tests/ledger/id-derivation-cross-adapter-parity
ci://tests/ledger/shadow-reconciliation-pg-vs-tigerbeetle-criteria
ci://tests/ledger/high-cardinality-sku-query-plan
```


## v0.13.3 shadow-mode operational evidence

- `docs/ops/tigerbeetle-shadow-mode-day-in-life.md`
- `ci://tests/ledger/shadow-worker-does-not-block-mvp-edit-path`
- `ci://benchmarks/BENCH-LEDGER-SHADOW-OPS-001`
