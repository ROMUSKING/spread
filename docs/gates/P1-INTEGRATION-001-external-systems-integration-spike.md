# P1-INTEGRATION-001: External Systems Integration Spike

**Version:** 0.16.1  
**Owner:** Platform/API Owner + Security Owner + Domain Owner  
**Waiver:** Not allowed for production connector rollout

## Goal

Prove the post-MVP integration adapter framework without weakening command/outbox authority or Phase 0 edit-path latency.

## Requirements

1. Implement one synthetic inbound adapter that stages data and creates a command proposal.
2. Implement one synthetic outbound webhook/connector that consumes durable outbox events.
3. Prove idempotency for inbound `external_operation_id` and outbound `outbox_event_id` delivery.
4. Prove duplicate inbound payload conflict detection.
5. Prove connector outage does not block command commit.
6. Prove dead-letter and replay behavior.
7. Prove data classification and redaction block unauthorized sinks.
8. Prove external object mappings are used for local/external identity reconciliation.
9. Prove integration jobs are checkpointed and auditable.
10. Prove AI/analytics/ledger planes consume integration data only through governed projections/events.
11. Prove no connector directly writes operational tables.
12. Prove integrations have no direct TigerBeetle write path.
13. Prove OpenAPI/AsyncAPI contract generation for the selected adapter/event sample.
14. Prove external integration runtime is absent from Phase 0 vertical-slice hot path.

- Prove inbound payload size, content-type, malware scan, and schema validation block command proposal when invalid.

- Prove integration credentials use scoped service accounts, rotation metadata, revocation blocking, and audit.

- Prove adapter SDK cannot import operational repositories, outbox writers, command internals, or TigerBeetle clients.

- Prove high-volume inbound staging under rate-limit pressure with connector outage simulation.

## Evidence

```text
ci://tests/integration/inbound-staging-command-proposal
ci://tests/integration/outbound-outbox-delivery-idempotent
ci://tests/integration/inbound-idempotency-conflict
ci://tests/integration/connector-outage-does-not-block-command-commit
ci://tests/integration/dead-letter-replay
ci://tests/integration/regulated-sink-blocked
ci://tests/integration/external-object-mapping-reconciliation
ci://tests/integration/no-direct-operational-table-write
ci://tests/integration/no-direct-tigerbeetle-write
ci://tests/integration/contracts-openapi-asyncapi-generated
ci://benchmarks/BENCH-INTEGRATION-001
ci://benchmarks/BENCH-INTEGRATION-002
ci://benchmarks/BENCH-INTEGRATION-003
ci://benchmarks/BENCH-INTEGRATION-004
ci://benchmarks/BENCH-INTEGRATION-005
ci://benchmarks/BENCH-INTEGRATION-006
ci://tests/integration/inbound-payload-scan-schema-validated-before-command-proposal
ci://tests/integration/inbound-payload-size-content-type-limits
ci://tests/integration/inbound-negative-payload-quarantine-dead-letter
ci://tests/security/integration-secret-rotation-required
ci://tests/security/integration-service-account-scope-enforced
ci://tests/security/integration-credential-revocation-blocks-io
ci://tests/security/integration-credential-revocation-propagates-to-workers
ci://tests/security/integration-credential-rotation-overlap-window
ci://tests/security/integration-kms-envelope-encryption-required
ci://tests/integration/adapter-sdk-forbids-operational-repository-import
ci://tests/integration/adapter-sdk-no-direct-ledger-or-outbox-write
ci://tests/integration/idempotency-property-tests
ci://benchmarks/BENCH-INTEGRATION-007
```

## Exit decision

Admit, defer, or reject each integration mode separately:

```text
REST API
webhooks
file/EDI
SCIM provisioning
iPaaS connector
broker/CDC event feed
partner analytics export
```
