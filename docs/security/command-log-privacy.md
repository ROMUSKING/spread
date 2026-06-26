# Command Log Privacy Boundary

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Owner:** Security Owner + Compliance Owner

## Purpose

Define what command recovery may retain without turning `command_log` into a sensitive payload archive.

## Storage rules

| Data | Default | Rationale |
|---|---|---|
| canonical normalized body | hash only in `request_hash` | idempotency comparison |
| raw request body | not stored | avoids long-lived sensitive payload retention |
| raw request body hash | stored in `request_body_hash` | replay/debug equality evidence |
| response outcome | redacted in `response_body_redacted` | lets client render original safe outcome |
| sensitive response outcome | encrypted short-retention `response_ref` | exact replay without broad exposure |
| client IP | optional `client_ip`, retention-governed | abuse/security diagnostics |
| trace ID | text `trace_id` | compatible with W3C/OTEL trace context |
| correlation ID | text `correlation_id` | support and client-facing diagnosis |

## Required controls

- No raw request body persists in `command_log` by default.
- Redaction tests cover validation errors, permission denials, and formula/import failures.
- Support tooling may query by `command_id`, `correlation_id`, or `trace_id`, but must not reveal unauthorized workbook fields.
- Retention must match `docs/compliance/eu-dpa-dsr-matrix.md`.

## Evidence

- `ci://tests/security/command-log-redaction`
- `ci://tests/security/command-log-no-raw-request-body`
- `ci://tests/api/problem-json-shape`
- `ci://tests/observability/trace-correlation-propagation`

## Encrypted `response_ref` controls

When exact replay requires storage beyond a redacted response body, `response_ref` points to encrypted short-retention payload storage.

Requirements:

- Envelope encryption with tenant-scoped data-encryption key or equivalent key hierarchy.
- Key material managed by the platform KMS; application logs must never contain plaintext keys.
- Access to decrypt response refs requires support/security role authorization and audit logging.
- Rotation must support decrypting existing payloads during the retention window.
- Purge must respect command retention, legal hold, and DSR policy.
- A missing/deleted `response_ref` after retention must not cause blind command retry; it degrades to ambiguity/refresh behavior.

Evidence:

```text
ci://tests/security/response-ref-encryption-required
ci://tests/security/response-ref-access-audited
ci://tests/security/response-ref-key-rotation
```

## Ledger `user_data_*` data classification

TigerBeetle `user_data_*` values and PostgreSQL mirror columns must not encode PII directly. They are compact numeric pointers into PostgreSQL registries.

| Field | Allowed | Prohibited |
|---|---|---|
| `user_data_128` | numeric pointer to account/movement group | raw email, phone, customer name, invoice text |
| `user_data_64` | timestamp/bucket/compact numeric ID | raw account number, personal identifier |
| `user_data_32` | site/jurisdiction/warehouse compact code | high-cardinality customer/user identity |

PII lives in PostgreSQL business tables behind RLS and support access controls.

Evidence:

```text
ci://tests/security/tb-user-data-no-pii
ci://tests/security/ledger-mirror-rls-tenant-isolation
```

## Ledger mirror RLS example

Mirror tables must be tenant-scoped. Example policy shape:

```sql
ALTER TABLE tb_transfer_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY tb_transfer_registry_tenant_isolation
ON tb_transfer_registry
USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Equivalent policies are required for `tb_account_registry`, `tb_ledger_registry`, and numeric MVP tables.
