---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "accepted-post-MVP-boundary"
---

# ADR-0026: Integration Credential and Service Account Boundary

## Decision

Post-MVP integrations use scoped service accounts and secret references. Connectors do not run as omnipotent integration users and do not receive direct database or TigerBeetle credentials.

## Consequences

- `integration_connections.service_account_id` is mandatory.
- `credential_ref` points to a secret manager/KMS record.
- rotation, revocation, access audit, and secret scanning are release-blocking.
- inbound staging and outbound delivery fail closed when credentials are expired or revoked.
- marketplace adapters use SDK DTOs and cannot import command writer, repositories, or ledger clients directly.


## v0.14.2 clarification

Credential storage uses secret references plus KMS-backed envelope encryption. Rotations require an explicit overlap window, old/new secret-version audit, and revocation propagation to active workers within the configured cache TTL. Service accounts must be least-privilege and scoped by command type, object type, event type, classification ceiling, tenant, and connection.
