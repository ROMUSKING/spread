---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "developer contract"
---

# Numeric Ledger Plane Developer Contract

## Purpose

All conserved numeric movement must go through `NumericLedgerPort`. This strengthens the MVP and keeps the post-MVP TigerBeetle transition adapter-scoped.

## Interface

```ts
type U128Decimal = string;
type LedgerCode = number; // TigerBeetle u32-compatible; validate 1..4294967295 at boundaries.

type LedgerAmount = {
  minorUnits: string;   // unsigned integer decimal string
  scale: number;
};

type NumericAccountRef = {
  tenantId: string;
  ledgerCode: LedgerCode;
  accountIdDec: U128Decimal;
  accountKey: string;
  accountKind: string;
  normalBalance: 'debit' | 'credit';
  balanceConstraint: 'none' | 'debits_must_not_exceed_credits' | 'credits_must_not_exceed_debits';
  dimensions: Record<string, string>;
};

type NumericTransferInput = {
  tenantId: string;
  commandId: string;
  commandLineIndex: number;
  ledgerGroupId: string;
  linkedGroupIndex?: number;
  linkedGroupSize?: number;
  movementKind: string;
  ledgerCode: LedgerCode;
  debitAccountIdDec: U128Decimal;
  creditAccountIdDec: U128Decimal;
  amount: LedgerAmount;
  transferCode: number;
  mode: 'single_phase' | 'pending' | 'post_pending' | 'void_pending';
  pendingTransferIdDec?: U128Decimal;
  domainObjectRef?: Record<string, unknown>;
  originalBusinessAt?: string;
};

type NumericTransferGroupInput = {
  tenantId: string;
  commandId: string;
  ledgerGroupId: string;
  atomicity: 'single' | 'linked_all_or_none';
  transfers: NumericTransferInput[];
};

interface NumericLedgerPort {
  ensureAccount(account: NumericAccountRef): Promise<void>;
  postTransfer(input: NumericTransferInput): Promise<NumericTransferResult>;
  postTransferGroup(input: NumericTransferGroupInput): Promise<NumericTransferGroupResult>;
  createPendingTransfer(input: NumericTransferInput): Promise<NumericTransferResult>;
  postPendingTransfer(input: NumericTransferInput): Promise<NumericTransferResult>;
  voidPendingTransfer(input: NumericTransferInput): Promise<NumericTransferResult>;
  lookupTransfer(tenantId: string, transferIdDec: U128Decimal): Promise<NumericTransferResult | null>;
  rebuildProjection(tenantId: string, ledgerCode: LedgerCode): Promise<ProjectionRebuildResult>;
}
```

`postTransferGroup` is required even if MVP starts with single transfers. It preserves the future mapping to TigerBeetle linked transfer batches for multi-leg postings.

## Deterministic ID derivation

The canonical account/transfer ID derivation is defined only in `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules`. This developer contract must call that helper; it must not duplicate hash inputs.

The implementation must reject reserved IDs, collision-test the hash implementation, prove `UNIQUE (tenant_id, command_id, command_line_index, movement_kind)`, and store a `transfer_payload_hash` to detect same-ID/different-payload conflicts.

## MVP adapter

`PostgresMvpNumericLedgerAdapter` writes `numeric_accounts`, `numeric_transfers`, and `numeric_balance_projection` inside the same command transaction as the domain/audit/outbox writes where feasible.

Required behavior:

1. Deterministic transfer ID generation exactly as defined in `docs/data/numeric-ledger-contract.md`.
2. Idempotent retry for the same transfer ID and same `transfer_payload_hash`.
3. Rejection on same transfer ID with a different payload hash.
4. No direct mutable balance writes outside the adapter.
5. Projection rebuild from append-only transfers.
6. Reconciliation job that compares projections to transfer aggregation.
7. Account constraint checks matching the target TigerBeetle account flags.
8. Integration with `command_log`, `audit_events`, `domain_events`, and `outbox_events` using `ledger_group_id`.


## Default stock semantic compatibility

When `ledger_granularity = tenant_uom`, TigerBeetle does not structurally prevent transfers between different SKUs that share a UOM ledger. The domain movement planner and `NumericLedgerPort` adapter must enforce semantic compatibility before creating the transfer plan.

Required rule:

```text
source.sku_id == destination.sku_id
source.uom_code == destination.uom_code
source.lot_id == destination.lot_id unless transfer_code explicitly allows lot transformation
source.serial_id == destination.serial_id unless transfer_code explicitly allows serial transformation
source.stock_status -> destination.stock_status must be allowed by tb_stock_status_transition_policy
warehouse/bin changes require a transfer code in the stock_move family
```

Required evidence:

```text
ci://tests/ledger/stock-default-semantic-compatibility
ci://tests/ledger/stock-default-cross-sku-guard
```


## MVP allowed-code guard

Before posting, the adapter must resolve every account code and transfer code through `tb_code_registry`. MVP command handlers may use only codes where `allowed_in_mvp = true`. This is enforced by:

```text
ci://tests/ledger/mvp-command-uses-only-allowed-codes
```

The check prevents Phase 0/MVP command paths from accidentally using post-MVP-only TigerBeetle codes or migration-only codes.

## Default stock semantic compatibility

Default stock mode uses a broad stock-unit ledger, not one ledger per SKU. Therefore the domain adapter must enforce semantic compatibility before posting stock transfers.

Required validation:

1. Debit and credit accounts must belong to the same tenant, ledger, UOM, and scale.
2. Debit and credit account dimension groups must have the same `sku_id` unless the transfer code is a domain-approved transformation.
3. Source and destination stock statuses must form an allowed transition for the transfer code.
4. Cross-SKU, UOM-converting, bundle, manufacturing, or substitution movement must include a domain object reference and a fixture-backed transformation rule.
5. Self-transfers are rejected before hitting PostgreSQL or TigerBeetle.

Required tests:

```text
ci://tests/ledger/same-ledger-debit-credit-enforcement
ci://tests/ledger/stock-default-semantic-compatibility
ci://tests/ledger/stock-default-cross-sku-guard
ci://tests/ledger/stock-transformation-approval-required
```

## Future adapter

`TigerBeetleNumericLedgerAdapter` will preserve the same interface and map calls to TigerBeetle account and transfer requests after P1-LEDGER-001.

The domain command handler must not know whether the backing adapter is PostgreSQL MVP or TigerBeetle. Adapter selection is by `(tenant_id, ledger_code)` from `numeric_ledger_catalog.authoritative_engine` and `numeric_ledger_migration_state.stage`.

## Command handler pattern

```text
1. Authorize user and validate workflow/domain state.
2. Build numeric movement plan.
3. Derive account IDs and transfer IDs deterministically.
4. Call NumericLedgerPort.
5. Write domain object state and projections.
6. Write audit_events, domain_events, and outbox_events with ledger_group_id.
7. Mark command_log committed or rejected.
```

## Post-cutover command pattern

After a ledger is cut over, the adapter may post to TigerBeetle before finalizing PostgreSQL domain/audit/outbox state:

```text
1. command_log received in PostgreSQL.
2. Domain layer validates authorization, workflow, and object state.
3. TigerBeetle adapter creates deterministic transfer(s).
4. PostgreSQL transaction writes domain state, projection, audit/domain/outbox, and command terminal status.
5. If PostgreSQL fails after TigerBeetle succeeds, recovery uses deterministic transfer lookup and completes PostgreSQL projection/outbox repair.
```

Do not attempt a distributed ACID transaction between PostgreSQL and TigerBeetle. Treat recovery and reconciliation as first-class behavior.

## Recovery pattern

On lost HTTP response:

```text
1. Client polls command status.
2. API checks command_log.
3. If command_log is ambiguous, derive expected transfer IDs.
4. If matching numeric transfers exist and audit/domain/outbox correlation exists, resolve to committed.
5. If transfers exist but projection/outbox is missing, run recovery/reconciliation path.
6. Never blind-retry with a new command ID.
```

## Required tests

```text
ci://tests/ledger/deterministic-transfer-id
ci://tests/ledger/transfer-payload-hash-conflict-detected
ci://tests/ledger/mvp-command-uses-only-allowed-codes
ci://tests/ledger/same-ledger-debit-credit-enforcement
ci://tests/ledger/transfer-id-unique-command-line-movement-kind
ci://tests/ledger/transfer-id-canonical-derivation
ci://tests/ledger/idempotent-transfer-retry
ci://tests/ledger/transfer-id-reuse-conflict
ci://tests/ledger/deterministic-transfer-id-canonical-inputs
ci://tests/ledger/unique-command-line-movement-kind
ci://tests/ledger/mvp-command-uses-only-allowed-codes
ci://tests/ledger/same-ledger-debit-credit-enforcement
ci://tests/ledger/stock-default-semantic-compatibility
ci://tests/ledger/transfer-payload-hash-conflict-detected
ci://tests/ledger/no-direct-balance-update
ci://tests/ledger/account-constraint-enforcement
ci://tests/ledger/projection-rebuild-from-transfers
ci://tests/ledger/ambiguous-command-lookup-by-transfer-id
ci://tests/ledger/post-cutover-pg-repair-after-ledger-success
ci://tests/ledger/transfer-payload-hash-conflict-detected
ci://tests/ledger/same-ledger-debit-credit-enforcement
ci://tests/ledger/mvp-command-uses-only-allowed-codes
```

## Stock default-mode semantic guard

Default stock mode uses a tenant/UOM ledger rather than a SKU-specific ledger. That keeps ledger cardinality manageable but means the domain layer must block accidental cross-SKU movement before the adapter is called.

For generic stock receive/reserve/release/ship/move/quarantine/adjust commands, the command handler must verify:

```text
source.tenant_id == destination.tenant_id
source.sku_id == destination.sku_id
source.uom_code == destination.uom_code
source.stock_status -> destination.stock_status is allowed
lot and serial compatibility checks pass for controlled SKUs
warehouse/bin movement policy permits the route
```

Exceptions require explicit movement kinds and fixtures, such as manufacturing transformation, kit assembly, SKU substitution, or UOM conversion. These may not reuse generic stock movement commands.

Required evidence:

```text
ci://tests/ledger/stock-default-cross-sku-guard
ci://tests/ledger/stock-default-cross-sku-semantic-compatibility-fixtures
ci://tests/ledger/same-ledger-debit-credit-enforcement
ci://tests/ledger/mvp-command-uses-only-allowed-codes
```


## TigerBeetle field assignment policy

Implementation must follow `docs/data/tigerbeetle-field-assignment-policy.md`. The default is the hybrid model:

```text
Account.user_data_128 = account_dimension_group_id
Transfer.user_data_128 = movement_group_id
Transfer.id = deterministic command-line-derived idempotency key
```

Do not use raw `command_id` as default `Transfer.user_data_128`; store `command_id` in PostgreSQL transfer mirrors and use it in deterministic transfer ID generation.

## Type mapping implementation rule

Adapter code must implement the exact BigInt/string rules in `docs/data/numeric-ledger-contract.md#nodejs-and-tigerbeetle-type-mapping`.

- 128-bit and 64-bit TigerBeetle values use `bigint` internally and string/decimal storage at API/PostgreSQL boundaries.
- JavaScript `Number` is prohibited for IDs, amounts, `user_data_128`, `user_data_64`, and timestamps.
- TigerBeetle `timestamp` is not business `effective_at`.
- TigerBeetle failures map through the error table in the numeric ledger contract; retry always uses the same deterministic transfer ID.

Required evidence:

```text
ci://tests/ledger/id-derivation-test-vectors
ci://tests/ledger/id-derivation-cross-adapter-parity
ci://tests/ledger/tigerbeetle-error-mapping-retryability
```
