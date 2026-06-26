---
version: "0.14.3"
last-reviewed: "2026-06-26"
status: "one-page active summary"
---

# Threat Model Summary

## Command plane

Risks: replay, duplicate mutation, command ID reuse, ambiguous outcome, partial transaction leak. Controls: command log, request hash, one PostgreSQL mutation transaction, audit/domain/outbox correlation, command status recovery.

## Outbox plane

Risks: retention gap, payload bloat, duplicate delivery, schema drift, unauthorized route. Controls: outbox polling performance contract, event envelope, payload hash, consumer checkpoints, target-plane routing, classification checks, `SYNC_REQUIRED`.

## Ledger plane

Risks: deterministic ID drift, payload-hash mismatch, same-ledger violation, shadow mismatch, projection repair failure. Controls: canonical ledger ID reference, adapter parity tests, NumericLedgerPort, PostgreSQL MVP adapter, shadow/reconciliation gates.

## AI/analytics planes

Risks: authority creep, unrevalidated retrieval, vector result treated as truth, snapshot staleness, permission bypass. Controls: RetrievalRevalidator, source versions, permission scope hash, data classification, deterministic fact APIs.

## External integration plane

Risks: malicious import, oversized payload, schema confusion, credential leakage, overbroad service account, connector bypass, regulated export, dead-letter replay error. Controls: malware scan/quarantine, size/content-type limits, schema registry, secret references, service-account scopes, outbox-only outbound delivery, idempotency tests, dead-letter audit, adapter SDK boundary.


## Marketplace and adapter supply-chain threats

Risks: malicious adapter package, compromised dependency, adapter SDK importing operational repositories, confused-deputy service account, webhook signing bypass, payload smuggling through content-type mismatch, and replay of old external IDs. Controls: signed adapter artifacts, dependency pinning/scanning, SDK boundary tests, service-account scopes, webhook signature verification, size/content-type enforcement, idempotency key + payload hash checks, and dead-letter quarantine. Marketplace connectors remain post-MVP and require separate evidence before customer rollout.


## v0.14.3 integration-specific threat additions

| Threat | Control |
|---|---|
| malicious inbound file or payload | content-type allow-list, byte limit, malware scan/quarantine, schema validation before command proposal |
| schema smuggling or version confusion | `integration_payload_schema_registry`, schema version pinning, payload hash, and rejection of unknown required fields |
| credential theft or reuse | `credential_ref` only, KMS/envelope encryption, scoped service accounts, rotation, revocation, secret scanning |
| marketplace adapter supply-chain compromise | adapter SDK import boundaries, no operational repository imports, signed adapter artifacts before future marketplace rollout |
| connector bypass of command handlers | CI forbidden import tests and `EXT-001` release blocker |
| exfiltration to unapproved sink | sink classification ceilings, redaction policy, `EXT-006`, audited delivery attempts |
| poisoned integration-derived AI/analytics data | governed projection lineage, RetrievalRevalidator, classification checks, and no vector/analytics authority |

Marketplace connectors are not admitted in MVP. A future marketplace adapter must prove static import constraints, runtime egress limits, scoped credentials, signed package provenance, and invariant tests before customer enablement.
