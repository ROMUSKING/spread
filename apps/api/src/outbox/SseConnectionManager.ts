/**
 * AGENT-022 — SSE Connection Manager
 *
 * Manages active SSE connection instances, tracking their subscriptions
 * (tenant, workbook) and high watermarks for live-update broadcasting.
 */
import type { OutboxEnvelope } from "@erp/contracts/events";

export interface SseConnection {
  readonly id: string;
  readonly tenantId: string;
  readonly workbookId: string;
  highWatermark: string;
  send(event: OutboxEnvelope): void;
  sendSyncRequired(): void;
}

export class SseConnectionManager {
  private readonly connections = new Map<string, SseConnection>();

  /**
   * Register a new active SSE connection.
   */
  register(connection: SseConnection): void {
    this.connections.set(connection.id, connection);
  }

  /**
   * Unregister an SSE connection.
   */
  unregister(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Retrieve all active connections.
   */
  getConnections(): SseConnection[] {
    return [...this.connections.values()];
  }

  /**
   * Clear all active connections.
   */
  clear(): void {
    this.connections.clear();
  }
}
