/**
 * InstanceHeartbeat — Application instance heartbeat manager
 *
 * Work order: AGENT-050
 * Gate: P0-RATE-001 — Hot-path rate-limit safety
 *
 * Evidence URIs:
 *   ci://tests/rate-limit/cross-instance-budget-division
 *   ci://benchmarks/BENCH-RATE-001
 *
 * Purpose:
 *   Tracks active application instances via periodic heartbeat upserts to
 *   the `app_instance_heartbeats` table. The active instance count is used
 *   by RateLimiter for per-instance budget division.
 *
 * Table contract (DDL lives in canonical data-contract files):
 *   CREATE TABLE IF NOT EXISTS app_instance_heartbeats (
 *     instance_id  TEXT PRIMARY KEY,
 *     last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 */

import type { Queryable } from "@erp/db/transaction";

// ── Types ───────────────────────────────────────────────────────────────

/** Row shape returned by the active instance count query. */
interface CountRow {
  rows: Array<{ count: string }>;
}

/** Row shape returned by the cleanup query. */
interface DeleteResult {
  rowCount: number;
}

// ── InstanceHeartbeat ───────────────────────────────────────────────────

/**
 * Manages periodic heartbeat upserts for this application instance.
 *
 * Used by the rate limiter's budget division to determine how many active
 * instances share the global token budget.
 *
 * @see AGENT-050
 */
export class InstanceHeartbeat {
  private readonly _db: Queryable;
  private readonly _instanceId: string;
  private _intervalHandle: ReturnType<typeof setInterval> | null = null;

  private handleBeatError(error: unknown): void {
    console.error(`InstanceHeartbeat beat failed for instance ${this._instanceId}:`, error);
  }

  private scheduleBeat(): void {
    void this.beat().catch((error: unknown) => {
      this.handleBeatError(error);
    });
  }

  /**
   * @param db - Queryable database connection (from @erp/db/transaction)
   * @param instanceId - Unique identifier for this application instance
   *   (e.g., hostname + PID or a UUID generated at startup)
   */
  constructor(db: Queryable, instanceId: string) {
    this._db = db;
    this._instanceId = instanceId;
  }

  /**
   * Start periodic heartbeat upserts.
   *
   * @param intervalMs - Milliseconds between heartbeat upserts.
   *   Recommended: 15_000–30_000ms (must be shorter than the stale threshold
   *   used in getActiveInstanceCount / cleanupStale).
   */
  start(intervalMs: number): void {
    if (this._intervalHandle !== null) {
      // Already running — prevent duplicate intervals
      return;
    }

    // Fire an immediate heartbeat, then repeat on interval
    this.scheduleBeat();
    this._intervalHandle = setInterval(() => {
      this.scheduleBeat();
    }, intervalMs);

    // Allow the Node.js process to exit even if the interval is running
    if (this._intervalHandle && typeof this._intervalHandle === "object" && "unref" in this._intervalHandle) {
      this._intervalHandle.unref();
    }
  }

  /**
   * Stop the periodic heartbeat.
   *
   * Does NOT remove this instance from the heartbeats table — it will
   * be cleaned up naturally by cleanupStale() after the stale threshold.
   */
  stop(): void {
    if (this._intervalHandle !== null) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = null;
    }
  }

  /**
   * Perform a single heartbeat upsert.
   *
   * INSERT ON CONFLICT UPDATE ensures idempotent, single-row writes
   * regardless of whether this instance has been seen before.
   *
   * @see AGENT-050
   */
  async beat(): Promise<void> {
    await this._db.query(
      `INSERT INTO app_instance_heartbeats (instance_id, last_seen_at)
       VALUES ($1, now())
       ON CONFLICT (instance_id)
       DO UPDATE SET last_seen_at = now()`,
      [this._instanceId]
    );
  }

  /**
   * Get the count of instances whose heartbeat is more recent than
   * `now() - staleThresholdMs`.
   *
   * @param staleThresholdMs - Milliseconds; instances not seen within this
   *   window are considered stale and excluded from the count.
   * @returns Number of active instances (always ≥ 1 if this instance is healthy)
   *
   * @see AGENT-050 step 2: "active instance heartbeat and budget division"
   */
  async getActiveInstanceCount(staleThresholdMs: number): Promise<number> {
    const result = (await this._db.query(
      `SELECT COUNT(*)::text AS count
       FROM app_instance_heartbeats
       WHERE last_seen_at > now() - make_interval(secs := $1)`,
      [staleThresholdMs / 1000]
    )) as CountRow;

    const row = result.rows[0];
    const count = row ? parseInt(row.count, 10) : 0;
    return Math.max(1, count);
  }

  /**
   * Delete heartbeat rows for instances that have not been seen within
   * the stale threshold.
   *
   * Should be called periodically (e.g., every few minutes) to prevent
   * the heartbeat table from growing unboundedly.
   *
   * @param staleThresholdMs - Milliseconds; instances older than this are deleted.
   * @returns Number of stale rows deleted.
   *
   * @see AGENT-050 step 4: "heartbeat cleanup and stale-instance worst-case tests"
   */
  async cleanupStale(staleThresholdMs: number): Promise<number> {
    const result = (await this._db.query(
      `DELETE FROM app_instance_heartbeats
       WHERE last_seen_at <= now() - make_interval(secs := $1)`,
      [staleThresholdMs / 1000]
    )) as DeleteResult;

    return result.rowCount ?? 0;
  }

  /** Whether the heartbeat interval is currently running. */
  get isRunning(): boolean {
    return this._intervalHandle !== null;
  }

  /** The instance ID managed by this heartbeat. */
  get instanceId(): string {
    return this._instanceId;
  }
}
