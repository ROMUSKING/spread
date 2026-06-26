---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "single normative ID derivation reference"
owner: "Backend/API Owner + Data Platform Owner"
---

# Ledger ID Derivation Reference

## Purpose

This file is the single normative reference for deterministic TigerBeetle-compatible account and transfer ID derivation.

Other documents may state that deterministic IDs are required, but they must link here instead of redefining hash inputs, encoding, or test vectors.

## Canonical inputs

```text
account_id_dec  = u128_decimal(hash128("tb-account:v1", tenant_id, ledger_code, canonical_account_key))
transfer_id_dec = u128_decimal(hash128("tb-transfer:v1", tenant_id, command_id, command_line_index, movement_kind))
```

`movement_kind` is a canonical, versioned, ledger-family-qualified key such as:

```text
financial.invoice_post
financial.payment_received
stock.receive
stock.reserve
stock.ship
quota.allocate
```

`ledger_family` must not be added as a separate transfer-ID hash input unless a future ADR introduces `tb-transfer:v2`. The ledger-family dimension is already encoded in `movement_kind` when required.

## Encoding rules

1. UUIDs are normalized to lowercase canonical text.
2. Integers are normalized to base-10 ASCII without leading zeroes.
3. Business keys are normalized by their owning domain policy before this function is called.
4. Every part is encoded as `byteLength:value` using UTF-8 byte length.
5. Encoded parts are joined by `|`.
6. `SHA-256(preimage)` is computed.
7. The first 16 digest bytes are interpreted as unsigned big-endian u128.
8. If the result is `0` or `2^128 - 1`, bytes 16..31 are used.
9. If the fallback is also reserved, reject with `RESERVED_U128_ID_DERIVED` and page the correctness owner.

## TypeScript reference implementation

```ts
import { createHash } from 'node:crypto';

const U128_MAX = (1n << 128n) - 1n;

function canonicalPart(value: string | number | bigint): string {
  const raw = typeof value === 'bigint' ? value.toString(10) : String(value);
  const normalized = /^[0-9a-fA-F-]{36}$/.test(raw) ? raw.toLowerCase() : raw;
  return `${Buffer.byteLength(normalized, 'utf8')}:${normalized}`;
}

function u128FromSha256(parts: Array<string | number | bigint>): bigint {
  const preimage = parts.map(canonicalPart).join('|');
  const digest = createHash('sha256').update(preimage, 'utf8').digest();
  let value = BigInt('0x' + digest.subarray(0, 16).toString('hex'));
  if (value === 0n || value === U128_MAX) {
    value = BigInt('0x' + digest.subarray(16, 32).toString('hex'));
  }
  if (value === 0n || value === U128_MAX) {
    throw new Error('RESERVED_U128_ID_DERIVED');
  }
  return value;
}

export function deriveTransferIdDec(input: {
  tenantId: string;
  commandId: string;
  commandLineIndex: number;
  movementKind: string;
}): string {
  return u128FromSha256([
    'tb-transfer:v1',
    input.tenantId,
    input.commandId,
    input.commandLineIndex,
    input.movementKind,
  ]).toString(10);
}

export function deriveAccountIdDec(input: {
  tenantId: string;
  ledgerCode: string | bigint;
  canonicalAccountKey: string;
}): string {
  return u128FromSha256([
    'tb-account:v1',
    input.tenantId,
    input.ledgerCode,
    input.canonicalAccountKey,
  ]).toString(10);
}
```

## PostgreSQL SQL reference implementation

This SQL is a parity-test helper. Production adapters may derive IDs in TypeScript, but CI must prove SQL and TypeScript generate the same decimal IDs.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION ledger_canonical_part(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT length(convert_to(value, 'UTF8'))::TEXT || ':' || value;
$$;

CREATE OR REPLACE FUNCTION ledger_hash128_decimal(VARIADIC parts TEXT[])
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  preimage TEXT;
  digest BYTEA;
  value NUMERIC := 0;
  i INTEGER;
  u128_max CONSTANT NUMERIC := 340282366920938463463374607431768211455;
BEGIN
  SELECT string_agg(ledger_canonical_part(part), '|' ORDER BY ord)
    INTO preimage
  FROM unnest(parts) WITH ORDINALITY AS p(part, ord);

  digest := digest(preimage, 'sha256');

  FOR i IN 0..15 LOOP
    value := value * 256 + get_byte(digest, i);
  END LOOP;

  IF value = 0 OR value = u128_max THEN
    value := 0;
    FOR i IN 16..31 LOOP
      value := value * 256 + get_byte(digest, i);
    END LOOP;
  END IF;

  IF value = 0 OR value = u128_max THEN
    RAISE EXCEPTION 'RESERVED_U128_ID_DERIVED';
  END IF;

  RETURN value::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION ledger_derive_transfer_id_dec(
  tenant_id UUID,
  command_id UUID,
  command_line_index INTEGER,
  movement_kind TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT ledger_hash128_decimal(
    'tb-transfer:v1',
    lower(tenant_id::TEXT),
    lower(command_id::TEXT),
    command_line_index::TEXT,
    movement_kind
  );
$$;

CREATE OR REPLACE FUNCTION ledger_derive_account_id_dec(
  tenant_id UUID,
  ledger_code BIGINT,
  canonical_account_key TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT ledger_hash128_decimal(
    'tb-account:v1',
    lower(tenant_id::TEXT),
    ledger_code::TEXT,
    canonical_account_key
  );
$$;
```

## Test vectors

| Function | Inputs | Expected decimal ID | SHA-256 digest |
|---|---|---:|---|
| transfer | tenant `11111111-1111-1111-1111-111111111111`, command `22222222-2222-2222-2222-222222222222`, line `0`, kind `financial.invoice_post` | `289422811858150626337706564086778091748` | `d9bcce55aa1cb78bed4be0a77f58d8e42e9b855695f3db2ed74dbec09814b81c` |
| transfer | tenant `11111111-1111-1111-1111-111111111111`, command `22222222-2222-2222-2222-222222222222`, line `1`, kind `financial.invoice_post` | `95138655462161701823112069647906384888` | `479309dde9065e6836087d2cb12c2bf8368763c432febbf3bae3768dfc83fc12` |
| account | tenant `11111111-1111-1111-1111-111111111111`, ledger `826`, account key `tenant=11111111-1111-1111-1111-111111111111|kind=ar|counterparty=33333333-3333-3333-3333-333333333333` | `240436917871679920084827089691094539514` | `b4e2774ae492341286f1195abde3dcfa5f81dac5ebc0ccea2dbd328c8055a3fe` |
| account | tenant `11111111-1111-1111-1111-111111111111`, ledger `1001`, account key `tenant=11111111-1111-1111-1111-111111111111|sku=44444444-4444-4444-4444-444444444444|warehouse=55555555-5555-5555-5555-555555555555|status=available` | `10567818802858989989304572653620442816` | `07f349b1b66a4d8e22a1dc34a2cc36c0d3de12f814325903c57b876a5c335e3c` |

## Required CI parity tests

```text
ci://tests/ledger/id-derivation-test-vectors
ci://tests/ledger/id-derivation-sql-typescript-parity
ci://tests/ledger/id-derivation-cross-adapter-parity
ci://tests/ledger/id-derivation-fuzz-10k-pr
ci://tests/ledger/id-derivation-fuzz-1m-nightly
ci://tests/ledger/transfer-payload-hash-conflict-detected
```

## Property-based test rules

- PR CI generates at least 10k random tuples.
- Nightly CI generates at least 1m random tuples.
- Every tuple must produce the same decimal string in SQL, TypeScript, PostgreSQL MVP adapter, and TigerBeetle shadow adapter.
- Derived IDs must be inside `(0, 2^128 - 1)`.
- Same tuple must generate the same ID.
- Different payload with same derived ID must be treated as a release-blocking idempotency conflict.
- No adapter may add or remove hash inputs without changing the domain separator and opening a migration ADR.

## Payload hash parity

`transfer_payload_hash` uses canonical JSON with sorted keys over the transfer payload fields that TigerBeetle would receive plus ERP-required semantic fields:

```text
debit_account_id
credit_account_id
amount
pending_id
ledger
code
user_data_128
user_data_64
user_data_32
flags
movement_kind
```

CI must prove payload hash parity across adapters before strict shadow or cutover.
