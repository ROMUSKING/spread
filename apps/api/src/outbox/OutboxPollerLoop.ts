/**
 * AGENT-021 — Outbox Poller Loop
 *
 * Background polling daemon that wakes up periodically, coalescing subscriptions
 * across all local SSE connections. It queries the database at the lowest watermark
 * required by active subscribers and broadcasts events to relevant connections.
 *
 * @see docs/dev/outbox-polling-reader.md
 */
import type { OutboxPoller } from "./OutboxPoller";
import type { SseConnectionManager } from "./SseConnectionManager";

export class OutboxPollerLoop {
  private running = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private isPolling = false;

  private readonly poller: OutboxPoller;
  private readonly connectionManager: SseConnectionManager;
  private readonly pollIntervalMs: number;

  constructor(
    poller: OutboxPoller,
    connectionManager: SseConnectionManager,
    pollIntervalMs: number = 1000
  ) {
    this.poller = poller;
    this.connectionManager = connectionManager;
    this.pollIntervalMs = pollIntervalMs;
  }

  /**
   * Start the background polling loop.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  /**
   * Stop the background polling loop.
   */
  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private scheduleNext(): void {
    if (!this.running) return;
    const jitter = Math.floor(Math.random() * 200); // 0-200ms jitter
    this.timeoutId = setTimeout(async () => {
      await this.runTick();
      this.scheduleNext();
    }, this.pollIntervalMs + jitter);
  }

  /**
   * Run a single tick of the polling loop.
   */
  async runTick(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const connections = this.connectionManager.getConnections();
      if (connections.length === 0) {
        return;
      }

      // Build subscription index and find the minimum watermark among all active connections
      const tenantIds = new Set<string>();
      const workbookIdsByTenant = new Map<string, Set<string>>();
      let minWatermark: bigint | null = null;

      for (const conn of connections) {
        tenantIds.add(conn.tenantId);

        let workbooks = workbookIdsByTenant.get(conn.tenantId);
        if (!workbooks) {
          workbooks = new Set<string>();
          workbookIdsByTenant.set(conn.tenantId, workbooks);
        }
        workbooks.add(conn.workbookId);

        const connWatermark = BigInt(conn.highWatermark || "0");
        if (minWatermark === null || connWatermark < minWatermark) {
          minWatermark = connWatermark;
        }
      }

      if (minWatermark === null) {
        return;
      }

      const subscriptions = {
        tenantIds,
        workbookIdsByTenant,
      };

      const result = await this.poller.pollOnce(String(minWatermark), subscriptions);

      if (result.syncRequired) {
        // Broadcast SYNC_REQUIRED to all connections that might have suffered from the gap/budget breach
        for (const conn of connections) {
          conn.sendSyncRequired();
        }
        return;
      }

      if (result.events.length > 0) {
        for (const event of result.events) {
          const eventOutboxId = BigInt(event.outboxId);
          for (const conn of connections) {
            // Delivery rules:
            // 1. Must match tenant ID
            // 2. Must match workbook ID (if event is workbook-scoped)
            // 3. Monotonic delivery: E.outboxId > connection.highWatermark
            if (
              event.tenantId === conn.tenantId &&
              (!event.workbookId || event.workbookId === conn.workbookId) &&
              eventOutboxId > BigInt(conn.highWatermark || "0")
            ) {
              conn.send(event);
              conn.highWatermark = event.outboxId;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error in OutboxPollerLoop tick:", err);
    } finally {
      this.isPolling = false;
    }
  }
}
