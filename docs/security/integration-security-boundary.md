# Integration Security Boundary v0.14.2

**Version:** 0.14.2  
**Status:** Required security posture for post-MVP integrations

## Core rules

```text
1. External systems never bypass tenant, permission, workflow, or command checks.
2. External credentials are secrets, not configuration values.
3. Inbound payloads are untrusted until authenticated, classified, schema-validated, and mapped.
4. Outbound payloads use data-minimized schemas and routing policies.
5. Regulated data export is blocked unless Compliance Owner signs the integration policy.
6. AI/analytics derived from external data must pass RetrievalRevalidator before becoming user-visible.
```

## Authentication and authorization

Supported post-MVP patterns:

| Pattern | Use |
|---|---|
| OAuth 2.0/OIDC | SaaS API connectors and delegated access. |
| Client credentials | Server-to-server integrations with scoped service accounts. |
| Webhook signature secret | Inbound webhook authenticity. |
| mTLS | High-trust B2B integrations where required. |
| SCIM | Identity provisioning for users/groups after security gate. |
| SFTP key | Legacy file exchange only, with staging and malware scanning. |

## Service-account boundary

Service-account commands must include:

```text
service_account_id
external_system_id
integration_policy_version
acting_scope
command_id
request_hash
```

Service accounts may submit commands only for explicitly granted command types and object scopes.

## Secret handling

Forbidden:

```text
plaintext token in PostgreSQL
secret in logs
secret in outbox payload
secret in DuckDB snapshot
secret in pgvector chunk
secret in support bundle
```

Required:

```text
secret_ref
rotation_state
last_rotated_at
expires_at
access_audit
```

## Export controls

Outbound integration policy must define:

```text
allowed_event_types
allowed_data_classes
field allow-list
redaction policy
payload size limit
retention and revoke behavior
external destination region if known
```

## Required tests

```text
ci://tests/integration/external-webhook-signature-required
ci://tests/integration/service-account-scope-enforced
ci://tests/integration/regulated-export-blocked
ci://tests/integration/secrets-never-in-payloads-or-logs
ci://tests/integration/retrieval-revalidator-required-for-external-data
```

## Direct write prohibition

External systems never write operational tables directly. All external mutation intent must pass through command handlers or be staged as a reconciliation exception.


## v0.14.2 inbound payload controls

Inbound data must pass:

```text
authenticate -> rate limit -> content-type allow-list -> byte limit -> hash -> malware scan/quarantine -> schema validation -> classification/redaction -> mapping lookup -> command proposal
```

A scan failure, schema failure, content-type mismatch, byte-limit breach, revoked credential, or out-of-scope service account creates a rejected staging row or dead letter, never a command proposal.

## Credential lifecycle

`credential_ref` points to a secret manager/KMS record and never stores secret material. Rotation, revocation, access audit, and CI secret scanning are governed by `docs/security/integration-credential-management.md`.

## Connector bypass prevention

Marketplace, iPaaS, or partner adapters must use the `ExternalIntegrationAdapter` DTO boundary. Adapter packages cannot import operational repositories, command writer internals, TigerBeetle clients, or outbox writers.


## v0.14.2 credential boundary

KMS-backed credential references are required for production-like connector evidence. Integration workers receive scoped, short-lived access to decrypted secret material only at execution time. Secret access is audited and must be blocked immediately after revocation propagation.
