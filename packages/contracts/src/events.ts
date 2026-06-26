export type OutboxEnvelope<TPayload = unknown> = {
  outboxId: string;
  eventId: string;
  tenantId: string;
  workbookId?: string;
  eventType: string;
  schemaVersion: string;
  routeKey: string;
  partitionKey: string;
  payloadHash: string;
  payload?: TPayload;
  payloadRef?: string;
  dataClassification: "public" | "internal" | "confidential" | "regulated" | "blocked";
  createdAt: string;
};
