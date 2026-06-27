/**
 * AGENT-020 — Outbox Repository
 *
 * PostgreSQL outbox store implementing the two-stage polling pattern
 * and command-transaction event insertion.
 *
 * @see docs/data/event-envelope-contract.md
 * @see docs/data/outbox-polling-performance-contract.md
 */
import crypto from "crypto";
import type { Queryable } from "@erp/db/transaction";
import type {
  InsertOutboxEventParams,
  OutboxEnvelopeMetadata,
  OutboxPayloadRow,
} from "@erp/contracts/events";

/**
 * Generate a deterministic UUID v5-style event ID.
 * event_id = deterministic_uuid("outbox-event:v1", tenant_id, command_id, command_event_seq, event_type)
 *
 * Uses SHA-256 truncated to UUID format for determinism without requiring
 * a full UUID v5 implementation.
 */
export function generateDeterministicEventId(
  tenantId: string,
  commandId: string,
  commandEventSeq: number,
  eventType: string
): string {
  const input = `outbox-event:v1:${tenantId}:${commandId}:${commandEventSeq}:${eventType}`;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  // Format as UUID: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Generate a deterministic idempotency key for an outbox event.
 */
export function generateIdempotencyKey(
  tenantId: string,
  commandId: string,
  commandEventSeq: number,
  eventType: string
): string {
  return `outbox:${tenantId}:${commandId}:${commandEventSeq}:${eventType}`;
}

export function serializeOutboxPayload(payload: unknown): string | null {
  if (payload === undefined) {
    return null;
  }

  return JSON.stringify(payload);
}

/**
 * Outbox repository for PostgreSQL operations.
 *
 * Supports:
 * - Transactional event insertion (within command Boundary B)
 * - Two-stage polling: envelope metadata scan → payload fetch
 * - Retention gap detection
 */
export class OutboxRepository {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  /**
   * Insert an outbox event within the caller's transaction.
   * This MUST be called inside the same transaction as the command status update.
   *
   * @see docs/data/event-envelope-contract.md — "command_event_seq is allocated inside
   *      the same PostgreSQL mutation transaction"
   */
  async insertEvent(
    tx: Queryable,
    params: InsertOutboxEventParams
  ): Promise<{ outboxId: string }> {
    const sql = `
      INSERT INTO outbox_events (
        event_id, idempotency_key, tenant_id, workbook_id,
        command_id, command_event_seq,
        event_type, event_source, event_subject,
        aggregate_type, aggregate_id,
        route_key, partition_key, target_planes,
        schema_version, data_schema, payload_content_type,
        payload, payload_ref, payload_hash, payload_size_bytes,
        visibility_scope, data_classification, permission_scope_hash,
        trace_id, correlation_id
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9,
        $10, $11,
        $12, $13, $14::text[],
        $15, $16, $17,
        $18::jsonb, $19, $20, $21,
        $22, $23, $24,
        $25, $26
      )
      RETURNING outbox_id
    `;

    const result = await tx.query<any>(sql, [
      params.eventId,
      params.idempotencyKey,
      params.tenantId,
      params.workbookId ?? null,
      params.commandId ?? null,
      params.commandEventSeq ?? null,
      params.eventType,
      params.eventSource,
      params.eventSubject ?? null,
      params.aggregateType ?? null,
      params.aggregateId ?? null,
      params.routeKey,
      params.partitionKey,
      params.targetPlanes,
      params.schemaVersion,
      params.dataSchema,
      params.payloadContentType,
      serializeOutboxPayload(params.payload),
      params.payloadRef ?? null,
      params.payloadHash,
      params.payloadSizeBytes,
      params.visibilityScope,
      params.dataClassification,
      params.permissionScopeHash ?? null,
      params.traceId,
      params.correlationId,
    ]);

    const rows = result?.rows || result || [];
    return { outboxId: String(rows[0]?.outbox_id ?? "0") };
  }

  /**
   * Step 1 of two-stage polling: fetch envelope metadata only.
   * Uses covering index idx_outbox_events_tenant_poll for index-only scans.
   *
   * @see docs/data/outbox-polling-performance-contract.md — "scan envelope metadata only"
   */
  async fetchEnvelopeMetadataBatch(args: {
    afterOutboxId: string;
    tenantIds: readonly string[];
    limit: number;
  }): Promise<OutboxEnvelopeMetadata[]> {
    const sql = `
      SELECT
        outbox_id,
        event_id,
        tenant_id,
        workbook_id,
        event_type,
        schema_version,
        target_planes,
        data_classification,
        permission_scope_hash,
        payload_size_bytes,
        payload_hash,
        created_at,
        trace_id,
        route_key,
        partition_key,
        idempotency_key,
        command_id,
        command_event_seq,
        event_source,
        event_subject,
        aggregate_type,
        aggregate_id,
        data_schema,
        payload_content_type,
        visibility_scope,
        correlation_id
      FROM outbox_events
      WHERE outbox_id > $1
        AND tenant_id = ANY($2::uuid[])
      ORDER BY outbox_id ASC
      LIMIT $3
    `;

    const result = await this.db.query<any>(sql, [
      BigInt(args.afterOutboxId || "0"),
      args.tenantIds,
      args.limit,
    ]);
    const rows = result?.rows || result || [];

    return rows.map((row: any) => ({
      outboxId: String(row.outbox_id),
      eventId: row.event_id,
      idempotencyKey: row.idempotency_key,
      tenantId: row.tenant_id,
      workbookId: row.workbook_id ?? undefined,
      commandId: row.command_id ?? undefined,
      commandEventSeq: row.command_event_seq ?? undefined,
      eventType: row.event_type,
      eventSource: row.event_source,
      eventSubject: row.event_subject ?? undefined,
      aggregateType: row.aggregate_type ?? undefined,
      aggregateId: row.aggregate_id ?? undefined,
      schemaVersion: row.schema_version,
      dataSchema: row.data_schema,
      routeKey: row.route_key,
      partitionKey: row.partition_key,
      targetPlanes: row.target_planes ?? ["sse"],
      payloadContentType: row.payload_content_type ?? "application/json",
      payloadHash: row.payload_hash,
      payloadSizeBytes: row.payload_size_bytes,
      visibilityScope: row.visibility_scope,
      dataClassification: row.data_classification,
      permissionScopeHash: row.permission_scope_hash ?? undefined,
      traceId: row.trace_id,
      correlationId: row.correlation_id,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  /**
   * Step 2 of two-stage polling: fetch payloads only for deliverable events.
   * Called after local demand filtering confirms which events need payloads.
   *
   * @see docs/data/outbox-polling-performance-contract.md — "fetch payloads only for deliverable IDs"
   */
  async fetchPayloads(outboxIds: readonly string[]): Promise<OutboxPayloadRow[]> {
    if (outboxIds.length === 0) return [];

    const sql = `
      SELECT outbox_id, event_id, payload, payload_ref, payload_hash
      FROM outbox_events
      WHERE outbox_id = ANY($1::bigint[])
      ORDER BY outbox_id ASC
    `;

    const result = await this.db.query<any>(sql, [
      outboxIds.map((id) => BigInt(id)),
    ]);
    const rows = result?.rows || result || [];

    return rows.map((row: any) => ({
      outboxId: String(row.outbox_id),
      eventId: row.event_id,
      payload: row.payload,
      payloadRef: row.payload_ref ?? undefined,
      payloadHash: row.payload_hash,
    }));
  }

  /**
   * Get the minimum outbox_id still in the table for retention gap detection.
   * If client's high watermark < min(outbox_id), a retention gap has occurred
   * and SYNC_REQUIRED must be returned.
   */
  async getMinOutboxId(): Promise<string | null> {
    const sql = `SELECT MIN(outbox_id) AS min_id FROM outbox_events`;
    const result = await this.db.query<any>(sql, []);
    const rows = result?.rows || result || [];
    if (rows.length === 0 || rows[0].min_id === null) return null;
    return String(rows[0].min_id);
  }
}
