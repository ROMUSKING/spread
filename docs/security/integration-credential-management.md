---
version: "0.14.3"
last-reviewed: "2026-06-26"
status: "security contract"
---

# Integration Credential Management

External credentials are secret references bound to scoped integration service accounts. Plaintext secret material is never stored in PostgreSQL metadata, outbox events, logs, traces, fixtures, pgvector chunks, DuckDB snapshots, support bundles, documentation examples, or dead-letter payloads.

## Credential lifecycle

| State | Behavior |
|---|---|
| `current` | usable only if service-account scope checks pass |
| `rotation_due` | warning state; owner must rotate before expiry |
| `rotating` | old/new refs allowed only during the configured rotation overlap window |
| `expired` | blocks inbound staging, outbound delivery, replay, and command proposal creation |
| `revoked` | blocks immediately and emits audit + worker-revocation events |

Default maximum age is 90 days unless provider policy is shorter.

## Required metadata

Credential metadata may include only non-secret references and operational state:

```text
credential_ref
kms_key_ref
credential_secret_version
credential_rotation_state
credential_last_rotated_at
credential_expires_at
credential_revocation_propagated_at
service_account_id
connection_id
owner_user_id
```

## KMS and envelope-encryption requirement

`credential_ref` is an opaque reference to a secret stored outside ordinary PostgreSQL metadata. Implementations must use a managed KMS, HSM-backed secret store, or equivalent envelope-encryption design:

```text
credential_ref
  -> secret metadata record
  -> encrypted data key
  -> encrypted provider credential
  -> KMS key policy + audit trail
```

Plaintext credentials may exist only in process memory for the minimum duration needed to perform an authenticated connector operation.


## Envelope-encryption implementation profile

Recommended implementation:

```text
KMS master key / key-encryption key (KEK)
  -> encrypts tenant-scoped data-encryption key (DEK)
  -> DEK encrypts provider credential material
  -> credential_ref stores only provider, connection, secret version, encrypted DEK ref, and audit metadata
```

Minimum requirements:

- one DEK scope per tenant or per regulated integration boundary;
- KMS encryption context includes `tenant_id`, `integration_connection_id`, `credential_ref`, and `credential_secret_version`;
- plaintext provider credentials are never written to logs, traces, outbox payloads, dead letters, pgvector chunks, DuckDB snapshots, fixtures, or support bundles;
- credential unwrap/decrypt events emit audit records with actor/service account, connection, reason, and trace ID;
- key rotation supports old/new DEK overlap only during the configured rotation window;
- revoked credentials are blocked before every external call, not only at worker startup.

## Rotation overlap and revocation propagation

Rotation uses a bounded rotation overlap window:

```text
current -> rotation_due -> rotating -> current(new ref)
```

During `rotating`, both old and new `credential_ref` values may be accepted only for explicitly listed connector operations and for a bounded overlap window. Default maximum overlap is 24 hours unless the provider requires a shorter window.

Revocation is immediate for new work and must propagate to active workers:

```text
1. mark credential state revoked
2. emit integration_credential_revoked event
3. cancel queued outbound attempts using the ref
4. reject inbound staging for the connection
5. force active adapter workers to re-check credential state before each external call
6. emit audited revocation-complete evidence
```

Active workers must observe revocation through cache invalidation or a maximum credential-state cache TTL of 60 seconds. In-flight workers must re-check credential state immediately before each network call and immediately before writing delivery-attempt results; a revoked credential converts the attempt to `blocked_credential_revoked` rather than retrying with stale credentials.

## Service-account boundary

Every integration credential must be bound to a scoped service account with:

```text
allowed object types
allowed command types
allowed outbound event types
data-classification ceiling
connection allow-list
rate-limit class
owner
expiry and rotation owner
```

A credential alone is not authorization. The adapter must pass both credential-state and service-account-scope checks before staging inbound data, delivering outbound events, replaying dead letters, or creating command proposals.

## CI secret scanning enforcement

The pack requires CI secret scanning over:

```text
docs/
tests/fixtures/
OpenAPI and AsyncAPI examples
support-bundle examples
integration dead-letter examples
adapter SDK samples
```

A finding in these locations blocks merge unless Security Owner marks it false positive.

Required evidence:

```text
ci://tests/security/integration-secret-rotation-required
ci://tests/security/integration-service-account-scope-enforced
ci://tests/security/integration-secret-scanning-fixtures-docs
ci://tests/security/integration-secret-access-audited
ci://tests/security/integration-credential-revocation-blocks-io
ci://tests/security/integration-credential-revocation-propagates-to-workers
ci://tests/security/integration-credential-rotation-overlap-window
ci://tests/security/integration-kms-envelope-encryption-required
```
