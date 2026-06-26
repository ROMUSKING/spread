/**
 * AGENT-022 — SSE subscription handshake and recovery
 *
 * Implements SSE subscription route with comprehensive observability.
 *
 * @see docs/dev/outbox-polling-reader.md
 */
import crypto from "crypto";
import { SseConnectionManager } from "../outbox/SseConnectionManager.ts";
import { OutboxRepository } from "../outbox/OutboxRepository.ts";
import { getTracer, getMetrics } from "@erp/observability";

function hashId(id?: string): string {
  if (!id) return "";
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 12);
}

let globalConnectionManager: SseConnectionManager | null = null;
let globalRepo: OutboxRepository | null = null;

/**
 * Initialize the events route with active services.
 */
export function initEventsRoute(
  connectionManager: SseConnectionManager,
  repo: OutboxRepository
): void {
  globalConnectionManager = connectionManager;
  globalRepo = repo;
}

export function getConnectionManager(): SseConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new SseConnectionManager();
  }
  return globalConnectionManager;
}

export function getOutboxRepository(): OutboxRepository | null {
  return globalRepo;
}

/**
 * Main SSE stream endpoint handler.
 * Returns a ReadableStream that enqueues SSE-formatted event buffers.
 */
export function sseEventsRoute(
  tenantId: string,
  workbookId: string,
  lastEventId: string | null
): ReadableStream<Uint8Array> {
  const connectionManager = getConnectionManager();
  const repo = getOutboxRepository();
  const connectionId = crypto.randomUUID();
  const tracer = getTracer();
  const metrics = getMetrics();
  const sseEstablishStart = Date.now();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendString = (data: string) => {
        try {
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          // Stream might have closed
        }
      };

      const connection = {
        id: connectionId,
        tenantId,
        workbookId,
        highWatermark: lastEventId || "0",
        send(event: any) {
          const formatted = `id: ${event.outboxId}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
          sendString(formatted);

          // Record delivery latency telemetry
          const deliveryLag = Date.now() - new Date(event.createdAt).getTime();
          const deliverSpan = tracer.startSpan("erp.sse.deliver", {
            connection_count: connectionManager.getConnections().length,
            workbook_id_hash: hashId(workbookId),
            delivery_lag_ms: deliveryLag
          });
          deliverSpan.end();

          metrics.observe("erp_sse_delivery_lag_seconds", deliveryLag / 1000, {
            instance: "default-instance"
          });
        },
        sendSyncRequired() {
          const formatted = `event: SYNC_REQUIRED\ndata: {}\n\n`;
          sendString(formatted);
        },
      };

      const syncSpan = tracer.startSpan("erp.sse.initial_sync", {
        mode: lastEventId ? "resume" : "fresh",
        server_watermark: lastEventId || "0",
        snapshot_bytes: 0
      });

      // 1. Snapshot / Watermark initialization
      let currentMaxId = "0";
      if (repo) {
        try {
          const minSql = `SELECT MAX(outbox_id) AS max_id FROM outbox_events`;
          const res = await (repo as any).db.query(minSql, []);
          const rows = res?.rows || res || [];
          if (rows.length > 0 && rows[0].max_id !== null) {
            currentMaxId = String(rows[0].max_id);
          }
        } catch (err) {
          syncSpan.recordException(err);
          console.error("Failed to initialize SSE watermark:", err);
        }
      }

      syncSpan.setAttribute("server_watermark", lastEventId || currentMaxId);

      // Send connection established event
      sendString(`event: connected\ndata: ${JSON.stringify({ connectionId, baseWatermark: currentMaxId })}\n\n`);

      // 2. Resume Replay
      if (lastEventId && repo) {
        try {
          const minId = await repo.getMinOutboxId();
          if (minId !== null && BigInt(lastEventId) < BigInt(minId)) {
            // Retention gap!
            connection.sendSyncRequired();
            controller.close();
            syncSpan.end();
            return;
          }

          // Fetch replay events
          const metadata = await repo.fetchEnvelopeMetadataBatch({
            afterOutboxId: lastEventId,
            tenantIds: [tenantId],
            limit: 1000,
          });

          const deliverable = metadata.filter(
            (env) =>
              env.targetPlanes.includes("sse") &&
              (!env.workbookId || env.workbookId === workbookId)
          );

          if (deliverable.length > 0) {
            const ids = deliverable.map((e) => e.outboxId);
            const payloads = await repo.fetchPayloads(ids);
            const payloadMap = new Map(payloads.map((p) => [p.outboxId, p]));

            for (const meta of deliverable) {
              const pRow = payloadMap.get(meta.outboxId);
              if (pRow) {
                connection.send({
                  ...meta,
                  payload: pRow.payload,
                  payloadRef: pRow.payloadRef,
                });
                connection.highWatermark = meta.outboxId;
              }
            }
          }
        } catch (err) {
          syncSpan.recordException(err);
          console.error("Error during SSE replay:", err);
          connection.sendSyncRequired();
          controller.close();
          syncSpan.end();
          return;
        }
      } else {
        // Fresh connection: watermark is the current state of DB
        connection.highWatermark = currentMaxId;
      }

      syncSpan.end();
      metrics.observe("erp_sse_initial_sync_seconds", (Date.now() - sseEstablishStart) / 1000, {
        mode: lastEventId ? "resume" : "fresh"
      });

      // 3. Register for live updates
      connectionManager.register(connection);
    },

    cancel() {
      connectionManager.unregister(connectionId);
    },
  });
}

/**
 * Stub route mapping for compatibility
 */
export async function sseEventsRouteStub(): Promise<ReadableStream<Uint8Array>> {
  return sseEventsRoute("pilot-tenant", "pilot-workbook", null);
}
