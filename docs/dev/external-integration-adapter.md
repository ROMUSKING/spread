---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "implementation guide"
---

# External Integration Adapter

## Purpose

Define the post-MVP adapter pattern for external systems without weakening Phase 0 command/outbox authority.

## Adapter interface

```ts
export interface ExternalIntegrationAdapter {
  readonly providerKey: string;
  readonly supportedObjectTypes: readonly string[];
  readonly supportedEventTypes: readonly string[];

  validateConnection(input: ConnectionValidationInput): Promise<ConnectionValidationResult>;
  normalizeInbound(input: ExternalPayload): Promise<IntegrationImportProposal>;
  planOutbound(event: OutboxEnvelope): Promise<OutboundDeliveryPlan>;
  deliver(plan: OutboundDeliveryPlan): Promise<DeliveryResult>;
  readCheckpoint(streamKey: string): Promise<CheckpointReadResult>;
}
```

## Inbound flow

```text
external payload received
  -> authenticate connection
  -> validate tenant and allowed scopes
  -> normalize payload
  -> classify and redact
  -> write integration_import_staging
  -> create command proposal or command
  -> domain command handler executes normal transaction
```

Inbound adapters must not import directly into domain tables. They may reject, stage, or propose a command.

## Outbound flow

```text
outbox event visible
  -> integration dispatcher filters by target planes, sink, classification, and subscription
  -> adapter plans delivery
  -> delivery attempt recorded
  -> external call made outside command transaction
  -> response metadata recorded
  -> retry/dead-letter if needed
```

## Required implementation guardrails

| Guardrail | Rule |
|---|---|
| Idempotency | Every inbound and outbound operation has a stable idempotency key and payload hash. |
| Classification | Adapter cannot send data above the connection's approved classification. |
| Mapping | External identifiers live in `external_object_mappings`. |
| Retry | Retries never change payload hash or command intent. |
| Dead letter | Non-transient failures enter `integration_dead_letters`. |
| Command boundary | External data changes ERP state only through command handlers. |
| Specialized planes | TigerBeetle, pgvector, and DuckDB consume integration data only through governed projections/events. |

## Reference middleware sketch

```ts
export async function handleInboundIntegration(request: IntegrationRequest) {
  const connection = await connectionRegistry.requireActive(request.connectionId);
  await integrationAuthorizer.assertAllowed(connection, request.objectType, request.operation);

  const normalized = await adapter.normalizeInbound(request.payload);
  const payloadHash = sha256Canonical(normalized.payload);
  const idempotencyKey = buildIntegrationIdempotencyKey(connection.id, normalized.externalOperationId);

  const staged = await integrationStaging.claimOrReturn({
    tenantId: connection.tenantId,
    connectionId: connection.id,
    idempotencyKey,
    payloadHash,
    objectType: normalized.objectType,
    proposedCommandType: normalized.commandType,
    payloadRef: await payloadStore.putRedacted(normalized.payload),
  });

  if (staged.status === 'exists_same_payload') return staged.outcome;
  if (staged.status === 'exists_different_payload') throw new IntegrationIdempotencyConflict();

  return commandProposalService.createFromIntegration(staged);
}
```

## Performance budget

| Path | Target |
|---|---:|
| Inbound authenticate + idempotency claim p95 | 80 ms |
| Staging write p95 | 120 ms |
| Outbound dispatch planning p95 | 100 ms |
| Delivery attempt persistence p95 | 60 ms |
| Dead-letter write p95 | 60 ms |

These budgets are post-MVP P1 targets and must not be added to Phase 0 edit latency.


## v0.14.2 adapter security pipeline

Every inbound adapter must execute or delegate: authenticate, rate-limit, content-type allow-list, size check, payload hash, malware scan/quarantine, schema validation, classification/redaction, external mapping, and command proposal.

Adapters must use `docs/dev/external-adapter-sdk-contract.md`; they may not import operational repositories, command writer internals, outbox writers, or TigerBeetle clients.


## v0.14.2 command-proposal handoff

Adapters may emit only staged payloads or command proposals. They must call the command-proposal API after validation gates pass; they must not call repositories, outbox writers, TigerBeetle clients, or command internals directly. The command proposal includes `integration_import_id`, `idempotency_key`, `payload_hash`, `proposed_command_type`, `object_type`, `service_account_id`, and `classification_decision`.

If any validation state is not final-clean/valid, the adapter returns a rejection/quarantine result and must not create a command proposal.
