/**
 * Data classification levels for outbox event payloads.
 * Governs visibility, routing, and compliance handling.
 */
export type DataClassification = "public" | "internal" | "confidential" | "regulated" | "blocked";

/**
 * Full outbox envelope including payload.
 * Used when delivering events to SSE subscribers after demand filtering.
 */
export type OutboxEnvelope<TPayload = unknown> = {
  outboxId: string;
  eventId: string;
  idempotencyKey: string;
  tenantId: string;
  workbookId?: string | undefined;
  commandId?: string | undefined;
  commandEventSeq?: number | undefined;
  eventType: string;
  eventSource: string;
  eventSubject?: string | undefined;
  aggregateType?: string | undefined;
  aggregateId?: string | undefined;
  schemaVersion: number;
  dataSchema: string;
  routeKey: string;
  partitionKey: string;
  targetPlanes: string[];
  payloadContentType: string;
  payloadHash: string;
  payloadSizeBytes: number;
  payload?: TPayload | undefined;
  payloadRef?: string | undefined;
  visibilityScope: string;
  dataClassification: DataClassification;
  permissionScopeHash?: string | undefined;
  traceId: string;
  correlationId: string;
  createdAt: string;
};

/**
 * Envelope metadata without payload — used in the two-stage polling pattern.
 * Step 1: scan envelope metadata only (covering index).
 * Step 2: fetch payloads only for locally-deliverable events.
 * @see docs/data/outbox-polling-performance-contract.md
 */
export type OutboxEnvelopeMetadata = Omit<OutboxEnvelope, "payload" | "payloadRef">;

/**
 * Parameters for inserting an outbox event within the command transaction.
 * Deterministic event_id: uuid v5("outbox-event:v1", tenant_id, command_id, command_event_seq, event_type)
 * @see docs/data/event-envelope-contract.md
 */
export type InsertOutboxEventParams = {
  eventId: string;
  idempotencyKey: string;
  tenantId: string;
  workbookId?: string | undefined;
  commandId?: string | undefined;
  commandEventSeq?: number | undefined;
  eventType: string;
  eventSource: string;
  eventSubject?: string | undefined;
  aggregateType?: string | undefined;
  aggregateId?: string | undefined;
  routeKey: string;
  partitionKey: string;
  targetPlanes: string[];
  schemaVersion: number;
  dataSchema: string;
  payloadContentType?: string | undefined;
  payload?: unknown | undefined;
  payloadRef?: string | undefined;
  payloadHash: string;
  payloadSizeBytes: number;
  visibilityScope: string;
  dataClassification: DataClassification;
  permissionScopeHash?: string | undefined;
  traceId: string;
  correlationId: string;
};

/**
 * Result from a payload fetch operation (Step 2 of two-stage polling).
 */
export type OutboxPayloadRow = {
  outboxId: string;
  eventId: string;
  payload: unknown;
  payloadRef?: string;
  payloadHash: string;
};
