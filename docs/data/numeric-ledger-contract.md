---
version: "0.17.0"
last-reviewed: "2026-06-27"
status: "Approved contract baseline"
---

# Numeric Ledger Contract for MVP and TigerBeetle Transition

## Purpose

This document defines the MVP numeric ledger shape. The goal is to strengthen the MVP immediately while making the post-MVP move to TigerBeetle a controlled adapter transition rather than a domain-model rewrite.

## Decision

MVP keeps PostgreSQL as the runtime store for numeric movement, but every conserved numeric movement must be modeled as a TigerBeetle-shaped transfer:

```text
ledger_code + debit_account_id + credit_account_id + amount_minor + transfer_code + deterministic transfer_id
```

The MVP schema is not a general accounting engine and is not a substitute for domain policy. It is a compatibility layer for financial, stock, credit, quota, and capacity-style movements that can be represented as conserved quantities.


## Field assignment policy

TigerBeetle-compatible field assignment is normative in `docs/data/tigerbeetle-field-assignment-policy.md`. The MVP PostgreSQL adapter must preserve the future TigerBeetle query surface:

```text
ledger + code + user_data_128 + user_data_64 + user_data_32 + timestamp mirror columns
```

The chosen model is hybrid: accounts carry dimension-group pointers, while transfers carry movement-group pointers. PostgreSQL remains the semantic index catalog.

Do not redefine TigerBeetle field meanings in other documents; link to the field-assignment policy instead.

## Ledgerability test

A numeric field belongs in the numeric ledger only if all are true:

1. It represents a conserved quantity or claim.
2. It changes through append-only movement events.
3. It has a source account and destination account.
4. It needs idempotent mutation and recovery after ambiguous outcomes.
5. It must support immutable audit and reconciliation.
6. It can be represented as an unsigned fixed-scale integer amount.
7. Its business metadata can live outside the ledger in PostgreSQL.

Do not place prices, rates, formula outputs, forecasts, KPIs, approval thresholds, tax tables, UOM conversion tables, or free-form numeric attributes in this ledger.

## MVP source-of-truth rule

For MVP:

```text
PostgreSQL business tables are authoritative for business objects.
PostgreSQL numeric_transfers is authoritative for ledger-shaped numeric movement.
PostgreSQL numeric_balance_projection is derived and may be rebuilt.
```

After MVP:

```text
TigerBeetle transfers become authoritative for ledger-shaped numeric movement.
PostgreSQL numeric_transfers becomes a projection/import ledger or reconciliation mirror.
PostgreSQL remains authoritative for command, audit, domain objects, permissions, workflow, and outbox/SSE delivery.
```

## Canonical ID and amount compatibility rules

Deterministic TigerBeetle-compatible ID derivation is normative in `docs/data/ledger-id-derivation-reference.md`. Do not restate hash inputs, encoding, TypeScript code, SQL code, or test vectors in this document.

Compatibility rules owned here:

- `movement_kind` is stored on `numeric_transfers` and must match the canonical key used by the ID reference.
- The transfer-ID uniqueness proof is `UNIQUE (tenant_id, command_id, command_line_index, movement_kind)`.
- `0` and `2^128 - 1` are reserved and must not be emitted for account or transfer IDs.
- Store amounts as `NUMERIC(39,0)` minor units in MVP.
- Never use IEEE-754 floating point for ledger amounts.
- Store display scale in `numeric_ledger_catalog.scale`.
- The same `transfer_id_dec` with a different `transfer_payload_hash` is a hard idempotency conflict.

Required CI evidence:

```text
ci://tests/ledger/id-derivation-test-vectors
ci://tests/ledger/id-derivation-sql-typescript-parity
ci://tests/ledger/id-derivation-cross-adapter-parity
ci://tests/ledger/id-derivation-fuzz-10k-pr
ci://tests/ledger/id-derivation-fuzz-1m-nightly
```

### Node.js and TigerBeetle type mapping

- Treat all TigerBeetle 128-bit fields as `bigint` in adapter code and decimal `TEXT` or `NUMERIC(39,0)` in PostgreSQL.
- Never pass TigerBeetle IDs, `user_data_128`, `amount`, or timestamp values through JavaScript `Number`.
- `ledger`, `code`, and `user_data_32` may be represented as JavaScript `number` only after range validation.
- `user_data_64` and TigerBeetle timestamps use `bigint` or decimal strings.
- JSON API payloads expose 128-bit and 64-bit values as strings.

### Timestamp semantics

| Field | Meaning | Authority |
|---|---|---|
| TigerBeetle `timestamp` | Acceptance/order timestamp assigned by TigerBeetle. | TigerBeetle after cutover. |
| `effective_at` | Business/economic timestamp, such as invoice date or stock movement date. | PostgreSQL domain model. |
| `origin_event_at` | Time the source event occurred before ingestion. | PostgreSQL metadata. |
| `tb_user_data_64` for transfers | Encoded `effective_at_ns` or origin-time bucket by field policy. | PostgreSQL field-assignment policy. |

Never use TigerBeetle `timestamp` as invoice date, shipment date, period-close date, or user-facing edit time.

### TigerBeetle error mapping and retryability

| TigerBeetle result class | ERP mapping | Retry policy |
|---|---|---|
| `created` | Ledger transfer created. | Success. |
| `exists` with same `transfer_payload_hash` | Idempotent success. | Do not retry as new ID. |
| `exists` with different payload or different field result | `LEDGER_IDEMPOTENCY_CONFLICT`. | No retry; page correctness owner. |
| account not found after cutover | `LEDGER_ACCOUNT_NOT_FOUND`. | Repair account registry/import first; do not create blind transfer. |
| same-ledger or code validation failure | `LEDGER_CONTRACT_VIOLATION`. | Fix command/domain mapping. |
| balance constraint violation | Domain error such as insufficient funds/stock. | User-correctable only when domain permits. |
| timeout/transport failure before known result | `LEDGER_OUTCOME_UNKNOWN`. | Lookup deterministic transfer IDs before retrying. |
| TigerBeetle unavailable | `LEDGER_TEMPORARILY_UNAVAILABLE`. | Retry same transfer ID with backoff or mark command pending per adapter policy. |

Adapter code must preserve the command layer's no-blind-retry rule.

## MVP schema

```sql
CREATE TABLE numeric_ledger_catalog (
  tenant_id UUID NOT NULL,
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  ledger_key TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('money','stock','credit','quota','capacity')),
  scale SMALLINT NOT NULL CHECK (scale >= 0 AND scale <= 12),
  authoritative_engine TEXT NOT NULL DEFAULT 'postgres_mvp'
    CHECK (authoritative_engine IN ('postgres_mvp','tigerbeetle_shadow','tigerbeetle')),
  migration_stage TEXT NOT NULL DEFAULT 'mvp'
    CHECK (migration_stage IN ('mvp','model_freeze','historical_replay','passive_shadow','strict_shadow','cutover','rollback')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, ledger_code),
  UNIQUE (tenant_id, ledger_key)
);

CREATE TABLE numeric_accounts (
  tenant_id UUID NOT NULL,
  account_id_dec TEXT NOT NULL CHECK (account_id_dec ~ '^[0-9]+$' AND account_id_dec::numeric > 0 AND account_id_dec::numeric < 340282366920938463463374607431768211455),
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  account_key TEXT NOT NULL,
  account_kind TEXT NOT NULL,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit','credit')),
  balance_constraint TEXT NOT NULL DEFAULT 'none'
    CHECK (balance_constraint IN ('none','debits_must_not_exceed_credits','credits_must_not_exceed_debits')),
  dimensions JSONB NOT NULL,
  tigerbeetle_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, account_id_dec),
  UNIQUE (tenant_id, ledger_code, account_key),
  CHECK (account_id_dec ~ '^[0-9]+$'),
  CHECK (account_id_dec::numeric > 0 AND account_id_dec::numeric < 340282366920938463463374607431768211455),
  FOREIGN KEY (tenant_id, ledger_code)
    REFERENCES numeric_ledger_catalog (tenant_id, ledger_code)
);

CREATE TABLE numeric_transfers (
  tenant_id UUID NOT NULL,
  transfer_id_dec TEXT NOT NULL CHECK (transfer_id_dec ~ '^[0-9]+$' AND transfer_id_dec::numeric > 0 AND transfer_id_dec::numeric < 340282366920938463463374607431768211455),
  transfer_payload_hash TEXT NOT NULL,
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  debit_account_id_dec TEXT NOT NULL CHECK (debit_account_id_dec ~ '^[0-9]+$' AND debit_account_id_dec::numeric > 0 AND debit_account_id_dec::numeric < 340282366920938463463374607431768211455),
  credit_account_id_dec TEXT NOT NULL CHECK (credit_account_id_dec ~ '^[0-9]+$' AND credit_account_id_dec::numeric > 0 AND credit_account_id_dec::numeric < 340282366920938463463374607431768211455),
  amount_minor NUMERIC(39,0) NOT NULL CHECK (amount_minor > 0 AND amount_minor = floor(amount_minor)),
  transfer_code INTEGER NOT NULL CHECK (transfer_code >= 1 AND transfer_code <= 65535),
  command_id UUID NOT NULL,
  command_line_index INTEGER NOT NULL CHECK (command_line_index >= 0),
  ledger_group_id UUID NOT NULL,
  linked_group_index INTEGER NULL CHECK (linked_group_index IS NULL OR linked_group_index >= 0),
  linked_group_size INTEGER NULL CHECK (linked_group_size IS NULL OR linked_group_size > 0),
  movement_kind TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('single_phase','pending','post_pending','void_pending')),
  status TEXT NOT NULL CHECK (status IN ('posted','pending','voided','rejected','expired')),
  pending_transfer_id_dec TEXT NULL CHECK (pending_transfer_id_dec IS NULL OR (pending_transfer_id_dec ~ '^[0-9]+$' AND pending_transfer_id_dec::numeric > 0 AND pending_transfer_id_dec::numeric < 340282366920938463463374607431768211455)),
  domain_object_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  original_business_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, transfer_id_dec),
  UNIQUE (tenant_id, command_id, command_line_index, movement_kind),
  CHECK (transfer_id_dec ~ '^[0-9]+$'),
  CHECK (transfer_id_dec::numeric > 0 AND transfer_id_dec::numeric < 340282366920938463463374607431768211455),
  CHECK (pending_transfer_id_dec IS NULL OR (pending_transfer_id_dec ~ '^[0-9]+$' AND pending_transfer_id_dec::numeric > 0 AND pending_transfer_id_dec::numeric < 340282366920938463463374607431768211455)),
  CHECK (debit_account_id_dec <> credit_account_id_dec),
  CHECK ((linked_group_index IS NULL) = (linked_group_size IS NULL)),
  CHECK (linked_group_index IS NULL OR linked_group_index < linked_group_size),
  FOREIGN KEY (tenant_id, ledger_code)
    REFERENCES numeric_ledger_catalog (tenant_id, ledger_code),
  FOREIGN KEY (tenant_id, debit_account_id_dec)
    REFERENCES numeric_accounts (tenant_id, account_id_dec),
  FOREIGN KEY (tenant_id, credit_account_id_dec)
    REFERENCES numeric_accounts (tenant_id, account_id_dec)
);

CREATE INDEX idx_numeric_transfers_command
  ON numeric_transfers (tenant_id, command_id);

CREATE INDEX idx_numeric_transfers_group
  ON numeric_transfers (tenant_id, ledger_group_id, linked_group_index);

CREATE INDEX idx_numeric_transfers_accounts
  ON numeric_transfers (tenant_id, ledger_code, debit_account_id_dec, credit_account_id_dec);

CREATE TABLE numeric_balance_projection (
  tenant_id UUID NOT NULL,
  account_id_dec TEXT NOT NULL CHECK (account_id_dec ~ '^[0-9]+$' AND account_id_dec::numeric > 0 AND account_id_dec::numeric < 340282366920938463463374607431768211455),
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  debits_posted_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  credits_posted_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  debits_pending_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  credits_pending_minor NUMERIC(39,0) NOT NULL DEFAULT 0,
  rebuilt_from_transfer_id_dec TEXT NULL,
  projection_version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id_dec),
  FOREIGN KEY (tenant_id, account_id_dec)
    REFERENCES numeric_accounts (tenant_id, account_id_dec)
);

CREATE TABLE numeric_ledger_migration_state (
  tenant_id UUID NOT NULL,
  ledger_code BIGINT NOT NULL CHECK (ledger_code > 0 AND ledger_code <= 4294967295),
  stage TEXT NOT NULL CHECK (stage IN ('mvp','model_freeze','historical_replay','passive_shadow','strict_shadow','cutover','rollback')),
  tigerbeetle_cluster_ref TEXT NULL,
  last_replayed_transfer_id_dec TEXT NULL,
  shadow_lag_seconds INTEGER NULL,
  last_reconciliation_at TIMESTAMPTZ NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (reconciliation_status IN ('not_started','passing','failing','waived')),
  owner_signoff JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, ledger_code),
  FOREIGN KEY (tenant_id, ledger_code)
    REFERENCES numeric_ledger_catalog (tenant_id, ledger_code)
);
```

## Balance projection rule

`numeric_balance_projection` is not an authoritative mutable balance table. It is derived from `numeric_transfers` and may be rebuilt. Application code must not update it directly except through the ledger adapter or reconciliation job.

The PostgreSQL MVP adapter must enforce TigerBeetle-style account constraints in the same transaction that inserts the transfer:

```text
1. Lock affected numeric_accounts and numeric_balance_projection rows.
2. Validate account ledgers match the transfer ledger_code.
3. Apply pending/posted debit and credit deltas in memory.
4. Reject if the account balance_constraint would be violated.
5. Insert numeric_transfers idempotently.
6. Update numeric_balance_projection from the same computed deltas.
```

This strengthens MVP immediately and makes later TigerBeetle account flags an implementation detail rather than a semantic change.

## Account modeling examples

| Domain | Ledger code example | Account key dimensions |
|---|---:|---|
| GBP money | 826 | tenant, account_type, natural_account, counterparty optional |
| EUR money | 978 | tenant, account_type, natural_account, counterparty optional |
| SKU stock | tenant-defined integer | tenant, sku, warehouse, bin, lot, stock_status |
| Reservation | same stock ledger | tenant, sku, warehouse, bin, lot, stock_status=`reserved` |
| Customer credit | tenant-defined integer | tenant, customer, credit_program |
| Capacity | tenant-defined integer | tenant, resource, time_bucket, capacity_type |

## Stock modeling rule

MVP should model stock states as accounts:

```text
available -> reserved -> shipped
available -> quarantine
available -> damaged
in_transit -> available
adjustment_source -> available
available -> adjustment_loss
```

This maps cleanly to TigerBeetle accounts and transfers later. Pending transfers may be used post-MVP for reservation holds after P1-LEDGER-001 proves the behavior and expiry semantics match the product UX.

## Prohibited MVP patterns

- Direct `UPDATE stock_balance SET quantity = quantity - ...` outside the ledger adapter.
- Direct `UPDATE account_balance SET balance = ...` outside the ledger adapter.
- Negative signed transfer amounts.
- Floating point ledger amounts.
- Transfer IDs generated from database sequences or random UUIDs.
- Business-rule decisions inside the ledger adapter.


## Post-MVP TigerBeetle mirror registry schema

This section is the canonical DDL source for post-MVP TigerBeetle field-assignment registries and PostgreSQL mirror tables. `docs/data/tigerbeetle-field-assignment-policy.md` defines meanings and selected strategy; this contract owns the executable schema.

The MVP schema in `docs/data/numeric-ledger-contract.md` remains valid. The post-MVP mirror adds explicit TigerBeetle field-assignment registries and query-surface indexes.

## Ecommerce + Owned Warehouse Ledger Patterns (basic SME)

For basic online ecommerce + owned warehouse (see pilot-dataset-definition.md ecommerce subsection and the full model in `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md`):

**Stock ledger (conserved, status accounts per stock modeling rule above):**
- Ledger code example: tenant-defined for "stock_qty" (scale 0 for units).
- Accounts (dimensions): tenant + product/sku + warehouse + stock_status (available | reserved | shipped | quarantine).
- Movements (via PostgresMvpNumericLedgerAdapter in same tx as cells):
  - `inventory.adjust` / receive: stock transfer available <- adjustment_source or in_transit (movement_kind: 'stock_receive' or 'stock_adjust')
  - `fulfillment.allocate`: available -> reserved (movement_kind: 'stock_reserve')
  - `order.fulfillShip`: reserved -> shipped ; inventory asset valuation credit + COGS (movement_kind: 'stock_ship', 'cogs_fulfill')
  - Return: reverse with 'stock_return', 'cogs_reverse', 'ar_credit'

**Money ledger patterns (basic):**
- Accounts (dimensions): tenant + `receivables` (AR), `revenue`, `tax_liability`, `cash`, `inventory_valuation`, `cogs`.
- Invoice Posting (movement_kinds: `ar_invoice` for pre-tax, `ar_invoice_tax` for tax offset):
  - Debit customer `receivables` (total invoice amount)
  - Credit `revenue` (pre-tax subtotal)
  - Credit `tax_liability` (calculated tax amount)
- Payment (movement_kind: `payment_receive`): debit `cash`, credit customer `receivables`.
- Returns (movement_kind: `ar_credit`): reverse the invoice postings (credit receivables, debit revenue, debit tax liability).
- Revenue recognition and COGS on fulfill/ship using standard_cost from Products cell at the time of movement (domainObjectRef carries product_id + order ref for recon).
- Cash on payment.record.
- Use `commandId`, `commandLineIndex`, `domainObjectRef: {orderId, lineId?, productId, warehouseId}` in every NumericTransferDraft.
- Example transfer (in handler):
  `ledger.createTransfer({ transferIdDec: deterministicFrom(commandId, line), debitAccountIdDec: arAccount, creditAccountIdDec: revenueAccount, amountDec: ..., ledgerCode: moneyLedger, movementKind: 'ar_invoice', ... })`
  And for tax:
  `ledger.createTransfer({ transferIdDec: deterministicFrom(commandId, line), debitAccountIdDec: arAccount, creditAccountIdDec: taxLiabilityAccount, amountDec: ..., ledgerCode: moneyLedger, movementKind: 'ar_invoice_tax', ... })`

**COGS / valuation (basic scope):** Standard cost (Products.cost or standard_cost cell snapshot at fulfill time). Posted as paired transfers on fulfillShip and returns. No moving-average or complex costing in "basic".

**3-way receive / returns:** Basic match in PO receive handler may post stock + AP effects or flag variance; only post on match-or-accepted. Returns reverse specific movement_kinds to keep reconcilable.

All movements participate in AUD-001 (command_id on transfers) and are emitted via outbox (domain events). Direct balance updates outside the adapter are prohibited.

Update numeric_accounts seeds in demo / fixtures when ecom ledgers are exercised.


### 10.1 Field assignment policy registry

```sql
CREATE TABLE tb_field_assignment_policy (
  policy_version INTEGER NOT NULL,
  ledger_family TEXT NOT NULL,
  object_kind TEXT NOT NULL CHECK (object_kind IN ('account', 'transfer')),
  ledger_semantics TEXT NOT NULL,
  code_semantics TEXT NOT NULL,
  user_data_128_semantics TEXT NOT NULL,
  user_data_64_semantics TEXT NOT NULL,
  user_data_32_semantics TEXT NOT NULL,
  selected_strategy TEXT NOT NULL DEFAULT 'hybrid',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (policy_version, ledger_family, object_kind),
  CHECK (deprecated_at IS NULL OR deprecated_at > valid_from)
);
```

### 10.2 Ledger registry

```sql
CREATE TABLE tb_ledger_registry (
  tenant_id UUID NOT NULL,
  tb_ledger_id BIGINT NOT NULL CHECK (tb_ledger_id > 0 AND tb_ledger_id <= 4294967295),
  ledger_family TEXT NOT NULL CHECK (
    ledger_family IN ('financial','stock','reservation','credit','quota','capacity')
  ),
  asset_code TEXT NOT NULL,
  asset_scale SMALLINT NOT NULL CHECK (asset_scale >= 0 AND asset_scale <= 12),
  ledger_granularity TEXT NOT NULL CHECK (
    ledger_granularity IN ('tenant_currency','tenant_uom','tenant_sku_uom','tenant_capacity_unit')
  ),
  migration_state TEXT NOT NULL CHECK (
    migration_state IN ('mvp','model_freeze','historical_replay','passive_shadow','strict_shadow','cutover','rollback','archived')
  ),
  field_assignment_policy_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, tb_ledger_id),
  UNIQUE (tb_ledger_id),
  UNIQUE (tenant_id, ledger_family, asset_code, asset_scale, ledger_granularity)
);
```

### 10.2.1 Stock status transition policy

Default stock ledgers keep SKU and lot semantics in PostgreSQL. This table is the normative guardrail that prevents TigerBeetle's broad UOM ledger from admitting invalid source/destination stock movements.

```sql
CREATE TABLE tb_stock_status_transition_policy (
  ledger_family TEXT NOT NULL DEFAULT 'stock',
  transfer_code_key TEXT NOT NULL,
  from_stock_status TEXT NOT NULL,
  to_stock_status TEXT NOT NULL,
  allows_warehouse_change BOOLEAN NOT NULL DEFAULT false,
  allows_lot_change BOOLEAN NOT NULL DEFAULT false,
  allows_serial_change BOOLEAN NOT NULL DEFAULT false,
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (ledger_family, transfer_code_key, from_stock_status, to_stock_status)
);
```

### 10.3 Code registry

```sql
CREATE TABLE tb_code_registry (
  code_kind TEXT NOT NULL CHECK (code_kind IN ('account', 'transfer')),
  ledger_family TEXT NOT NULL,
  tb_code INTEGER NOT NULL CHECK (tb_code >= 1 AND tb_code <= 65535),
  code_key TEXT NOT NULL,
  description TEXT NOT NULL,
  allowed_in_mvp BOOLEAN NOT NULL DEFAULT false,
  deprecated_at TIMESTAMPTZ NULL,
  PRIMARY KEY (code_kind, ledger_family, tb_code),
  UNIQUE (code_kind, ledger_family, code_key)
);
```

### 10.4 Account registry and mirror

```sql
CREATE TABLE tb_account_registry (
  tenant_id UUID NOT NULL,
  tb_account_id NUMERIC(39, 0) NOT NULL CHECK (tb_account_id > 0 AND tb_account_id < 340282366920938463463374607431768211455),
  tb_ledger_id BIGINT NOT NULL CHECK (tb_ledger_id > 0 AND tb_ledger_id <= 4294967295),
  tb_account_code INTEGER NOT NULL CHECK (tb_account_code >= 1 AND tb_account_code <= 65535),
  tb_user_data_128 NUMERIC(39, 0) NOT NULL DEFAULT 0 CHECK (tb_user_data_128 >= 0 AND tb_user_data_128 <= 340282366920938463463374607431768211455),
  tb_user_data_64 NUMERIC(20, 0) NOT NULL DEFAULT 0 CHECK (tb_user_data_64 >= 0 AND tb_user_data_64 <= 18446744073709551615),
  tb_user_data_32 BIGINT NOT NULL DEFAULT 0 CHECK (tb_user_data_32 >= 0 AND tb_user_data_32 <= 4294967295),
  ledger_family TEXT NOT NULL,
  field_assignment_policy_version INTEGER NOT NULL,
  account_dimension_group_id UUID NOT NULL,
  business_entity_type TEXT NULL,
  business_entity_id UUID NULL,
  sku_id UUID NULL,
  warehouse_id UUID NULL,
  bin_id UUID NULL,
  lot_id UUID NULL,
  serial_id UUID NULL,
  uom_code TEXT NULL,
  stock_status TEXT NULL,
  currency_code TEXT NULL,
  jurisdiction_code TEXT NULL,
  site_code TEXT NULL,
  balance_constraint TEXT NOT NULL CHECK (
    balance_constraint IN ('none','debits_must_not_exceed_credits','credits_must_not_exceed_debits')
  ),
  tb_flags INTEGER NOT NULL DEFAULT 0,
  tb_created_timestamp_ns NUMERIC(20, 0) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL,
  PRIMARY KEY (tenant_id, tb_account_id),
  UNIQUE (tb_account_id),
  CHECK (tb_account_id > 0 AND tb_account_id < 340282366920938463463374607431768211455)
);
```

### 10.5 Transfer registry and mirror

```sql
CREATE TABLE tb_transfer_registry (
  tenant_id UUID NOT NULL,
  tb_transfer_id NUMERIC(39, 0) NOT NULL CHECK (tb_transfer_id > 0 AND tb_transfer_id < 340282366920938463463374607431768211455),
  tb_debit_account_id NUMERIC(39, 0) NOT NULL CHECK (tb_debit_account_id > 0 AND tb_debit_account_id < 340282366920938463463374607431768211455),
  tb_credit_account_id NUMERIC(39, 0) NOT NULL CHECK (tb_credit_account_id > 0 AND tb_credit_account_id < 340282366920938463463374607431768211455),
  tb_amount NUMERIC(39, 0) NOT NULL CHECK (tb_amount > 0),
  tb_pending_id NUMERIC(39, 0) NOT NULL DEFAULT 0 CHECK (tb_pending_id >= 0 AND tb_pending_id < 340282366920938463463374607431768211455),
  tb_ledger_id BIGINT NOT NULL CHECK (tb_ledger_id > 0 AND tb_ledger_id <= 4294967295),
  tb_transfer_code INTEGER NOT NULL CHECK (tb_transfer_code >= 1 AND tb_transfer_code <= 65535),
  tb_user_data_128 NUMERIC(39, 0) NOT NULL DEFAULT 0 CHECK (tb_user_data_128 >= 0 AND tb_user_data_128 <= 340282366920938463463374607431768211455),
  tb_user_data_64 NUMERIC(20, 0) NOT NULL DEFAULT 0 CHECK (tb_user_data_64 >= 0 AND tb_user_data_64 <= 18446744073709551615),
  tb_user_data_32 BIGINT NOT NULL DEFAULT 0 CHECK (tb_user_data_32 >= 0 AND tb_user_data_32 <= 4294967295),
  tb_flags INTEGER NOT NULL DEFAULT 0,
  tb_timeout_seconds INTEGER NOT NULL DEFAULT 0,
  tb_created_timestamp_ns NUMERIC(20, 0) NULL,
  ledger_family TEXT NOT NULL,
  field_assignment_policy_version INTEGER NOT NULL,
  command_id UUID NOT NULL,
  command_line_index INTEGER NOT NULL,
  movement_kind TEXT NOT NULL,
  movement_group_id UUID NOT NULL,
  transfer_payload_hash TEXT NOT NULL,
  business_event_type TEXT NOT NULL,
  business_document_type TEXT NULL,
  business_document_id UUID NULL,
  business_line_id UUID NULL,
  effective_at TIMESTAMPTZ NULL,
  origin_event_at TIMESTAMPTZ NULL,
  submission_state TEXT NOT NULL CHECK (
    submission_state IN ('planned','submitted','created','exists_same_payload','exists_different_payload','failed','repair_required','shadow_only','tigerbeetle_authoritative')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, tb_transfer_id),
  UNIQUE (tb_transfer_id),
  UNIQUE (tenant_id, command_id, command_line_index, movement_kind),
  CHECK (tb_debit_account_id <> tb_credit_account_id)
);
```

## 11. PostgreSQL indexes that mirror TigerBeetle access paths

```sql
-- Account identity and QueryFilter mirror.
CREATE UNIQUE INDEX ux_tb_account_registry_account_id
  ON tb_account_registry (tb_account_id);

CREATE INDEX ix_tb_accounts_qf_ledger_code_udata
  ON tb_account_registry (
    tb_ledger_id,
    tb_account_code,
    tb_user_data_128,
    tb_user_data_64,
    tb_user_data_32
  );

-- Semantic ERP lookups.
CREATE INDEX ix_tb_accounts_semantic_entity
  ON tb_account_registry (
    tenant_id,
    ledger_family,
    business_entity_type,
    business_entity_id
  );

CREATE INDEX ix_tb_accounts_stock_grid
  ON tb_account_registry (
    tenant_id,
    sku_id,
    warehouse_id,
    bin_id,
    lot_id,
    serial_id,
    stock_status,
    uom_code
  ) WHERE ledger_family = 'stock';

CREATE INDEX ix_tb_accounts_financial_grid
  ON tb_account_registry (
    tenant_id,
    currency_code,
    tb_account_code,
    business_entity_type,
    business_entity_id
  ) WHERE ledger_family = 'financial';

-- Transfer identity and QueryFilter mirror.
CREATE UNIQUE INDEX ux_tb_transfer_registry_transfer_id
  ON tb_transfer_registry (tb_transfer_id);

CREATE INDEX ix_tb_transfers_qf_ledger_code_udata_time
  ON tb_transfer_registry (
    tb_ledger_id,
    tb_transfer_code,
    tb_user_data_128,
    tb_user_data_64,
    tb_user_data_32,
    tb_created_timestamp_ns
  );

-- AccountFilter mirrors.
CREATE INDEX ix_tb_transfers_debit_account_time
  ON tb_transfer_registry (
    tb_debit_account_id,
    tb_created_timestamp_ns,
    tb_transfer_code
  );

CREATE INDEX ix_tb_transfers_credit_account_time
  ON tb_transfer_registry (
    tb_credit_account_id,
    tb_created_timestamp_ns,
    tb_transfer_code
  );

-- ERP recovery and replay.
CREATE INDEX ix_tb_transfers_command_recovery
  ON tb_transfer_registry (tenant_id, command_id, command_line_index, movement_kind);

CREATE INDEX ix_tb_transfers_business_document
  ON tb_transfer_registry (
    tenant_id,
    business_document_type,
    business_document_id,
    business_line_id
  );

CREATE INDEX ix_tb_transfers_movement_group
  ON tb_transfer_registry (
    tenant_id,
    movement_group_id,
    tb_created_timestamp_ns
  );

CREATE INDEX ix_tb_transfers_pending_lifecycle
  ON tb_transfer_registry (tenant_id, tb_pending_id, submission_state)
  WHERE tb_pending_id <> 0;
```



## TigerBeetle width compatibility

PostgreSQL mirror and MVP columns must preserve TigerBeetle unsigned field ranges:

| TigerBeetle field | PostgreSQL representation |
|---|---|
| `id`, `pending_id`, `user_data_128` | `NUMERIC(39,0)` or decimal text with `> 0` and `< 2^128 - 1` for IDs; `user_data_128` may be zero. |
| `user_data_64`, timestamps | `NUMERIC(20,0)` with `0 <= value <= 18446744073709551615`. |
| `ledger`, `user_data_32` | `BIGINT` with `0 < ledger <= 4294967295` and `0 <= user_data_32 <= 4294967295`. |
| `code` | `INTEGER CHECK (code >= 1 AND code <= 65535)`. |

Do not use PostgreSQL `SMALLINT` for TigerBeetle `code`, and do not use signed `INTEGER` for TigerBeetle `ledger` or `user_data_32` mirror columns.
