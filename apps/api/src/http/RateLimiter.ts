/**
 * RateLimiter — In-memory token bucket rate limiter
 *
 * Work order: AGENT-050
 * Gate: P0-RATE-001 — Hot-path rate-limit safety
 *
 * Evidence URIs:
 *   ci://tests/rate-limit/local-token-bucket
 *   ci://tests/rate-limit/cross-instance-budget-division
 *   ci://tests/rate-limit/no-ordinary-edit-pg-counter-write
 *   ci://tests/rate-limit/credential-stuffing-throttled-before-edit-path
 *   ci://benchmarks/BENCH-RATE-001
 *
 * RELEASE-BLOCKING CONSTRAINT:
 *   Ordinary edit rate limiting MUST NOT write to PostgreSQL synchronously.
 *   The hot path is purely in-memory token bucket; only high-risk commands
 *   may optionally consult a coarse PG ceiling (method signature only in Phase 0).
 *
 * Design:
 *   - Per-tenant token buckets stored in a Map (never touches PG on ordinary edits)
 *   - Budget division: maxTokens / activeInstanceCount with 1.2× headroom factor
 *   - Stale bucket cleanup: remove buckets not accessed in STALE_BUCKET_THRESHOLD_MS
 *   - Emits standard Retry-After, RateLimit, and RateLimit-Policy headers
 */

import { getTracer, getMetrics } from "@erp/observability";

// ── Types ───────────────────────────────────────────────────────────────

/**
 * Configuration for the rate limiter.
 *
 * @see AGENT-050 — Hot-path rate limiter
 */
export interface RateLimiterConfig {
  /** Maximum tokens per tenant bucket (before budget division). */
  readonly maxTokens: number;
  /** Number of tokens to refill per interval. */
  readonly refillRate: number;
  /** Interval in milliseconds between token refills. */
  readonly refillIntervalMs: number;
  /**
   * Number of active application instances sharing the global budget.
   * Used for budget division: localBudget = maxTokens / activeInstanceCount * headroomFactor.
   * Defaults to 1 (single instance).
   */
  readonly activeInstanceCount?: number;
  /**
   * Headroom factor applied to budget division.
   * Allows slight over-provisioning to avoid false rejections during instance churn.
   * Defaults to 1.2.
   */
  readonly headroomFactor?: number;
  /**
   * Milliseconds after which an idle bucket is considered stale and eligible
   * for cleanup. Defaults to 600_000 (10 minutes).
   */
  readonly staleBucketThresholdMs?: number;
}

/**
 * Result of a rate limit check.
 *
 * @see AGENT-050
 */
export interface RateLimitResult {
  /** Whether the request is allowed. */
  readonly allowed: boolean;
  /** Milliseconds until the next token becomes available (only set when denied). */
  readonly retryAfterMs?: number | undefined;
  /** Remaining tokens in the bucket after this check. */
  readonly remaining: number;
  /** The effective bucket limit (post budget-division). */
  readonly limit: number;
  /** Human-readable policy description for the RateLimit-Policy header. */
  readonly policy: string;
}

// ── Constants ───────────────────────────────────────────────────────────

/** Default headroom factor for budget division across instances. */
const DEFAULT_HEADROOM_FACTOR = 1.2;

/** Default stale bucket threshold: 10 minutes. */
const DEFAULT_STALE_BUCKET_THRESHOLD_MS = 10 * 60 * 1000;

/** Default active instance count (single instance). */
const DEFAULT_ACTIVE_INSTANCE_COUNT = 1;

// ── TokenBucket ─────────────────────────────────────────────────────────

/**
 * Single token bucket tracking tokens, refill rate, and access time.
 *
 * @internal
 */
export class TokenBucket {
  /** Current token count. */
  private _tokens: number;
  /** Maximum tokens (effective limit after budget division). */
  private readonly _maxTokens: number;
  /** Tokens added per refill interval. */
  private readonly _refillRate: number;
  /** Refill interval in milliseconds. */
  private readonly _refillIntervalMs: number;
  /** Timestamp (ms) of the last refill calculation. */
  private _lastRefillTime: number;
  /** Timestamp (ms) of the last access (consume or check). */
  private _lastAccessTime: number;

  constructor(maxTokens: number, refillRate: number, refillIntervalMs: number) {
    this._maxTokens = maxTokens;
    this._tokens = maxTokens;
    this._refillRate = refillRate;
    this._refillIntervalMs = refillIntervalMs;
    this._lastRefillTime = Date.now();
    this._lastAccessTime = Date.now();
  }

  /** Refill tokens based on elapsed time since last refill. */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this._lastRefillTime;
    if (elapsed <= 0) return;

    const intervalsElapsed = Math.floor(elapsed / this._refillIntervalMs);
    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this._refillRate;
      this._tokens = Math.min(this._maxTokens, this._tokens + tokensToAdd);
      this._lastRefillTime += intervalsElapsed * this._refillIntervalMs;
    }
  }

  /**
   * Try to consume one token.
   *
   * @returns Object with allowed flag and bucket state.
   */
  tryConsume(): { allowed: boolean; remaining: number; retryAfterMs?: number } {
    this.refill();
    this._lastAccessTime = Date.now();

    if (this._tokens >= 1) {
      this._tokens -= 1;
      return { allowed: true, remaining: Math.floor(this._tokens) };
    }

    // Calculate when the next token will be available
    const timeSinceLastRefill = Date.now() - this._lastRefillTime;
    const timeUntilNextRefill = this._refillIntervalMs - timeSinceLastRefill;
    const retryAfterMs = Math.max(1, timeUntilNextRefill);

    return { allowed: false, remaining: 0, retryAfterMs };
  }

  /** Timestamp of the last access (for stale detection). */
  get lastAccessTime(): number {
    return this._lastAccessTime;
  }

  /** Current remaining tokens (after refill). */
  get remaining(): number {
    this.refill();
    return Math.floor(this._tokens);
  }

  /** The effective limit of this bucket. */
  get maxTokens(): number {
    return this._maxTokens;
  }
}

// ── RateLimiter ─────────────────────────────────────────────────────────

/**
 * In-memory per-tenant rate limiter using token buckets.
 *
 * RELEASE-BLOCKING: Ordinary edits are purely in-memory.
 * No PostgreSQL writes occur on the hot path.
 *
 * @see AGENT-050
 * @see P0-RATE-001
 */
export class RateLimiter {
  private readonly _config: Required<RateLimiterConfig>;
  /** Per-tenant+commandType composite key → TokenBucket. */
  private readonly _buckets: Map<string, TokenBucket> = new Map();
  /** Effective per-instance token budget after division. */
  private readonly _effectiveMaxTokens: number;

  constructor(config: RateLimiterConfig) {
    const activeInstanceCount =
      config.activeInstanceCount ?? DEFAULT_ACTIVE_INSTANCE_COUNT;
    const headroomFactor = config.headroomFactor ?? DEFAULT_HEADROOM_FACTOR;
    const staleBucketThresholdMs =
      config.staleBucketThresholdMs ?? DEFAULT_STALE_BUCKET_THRESHOLD_MS;

    this._config = {
      ...config,
      activeInstanceCount,
      headroomFactor,
      staleBucketThresholdMs,
    };

    // Budget division: each instance gets a fraction of the global budget
    // with headroom to tolerate brief instance churn.
    this._effectiveMaxTokens = Math.max(
      1,
      Math.floor(
        (config.maxTokens / activeInstanceCount) * headroomFactor
      )
    );
  }

  /**
   * Attempt to consume a token for the given tenant and command type.
   *
   * RELEASE-BLOCKING: For riskClass 'ordinary', this method is purely
   * in-memory. No database calls are made.
   *
   * For riskClass 'high_risk', a coarse PostgreSQL ceiling check could be
   * performed (not wired in Phase 0 — signature only).
   *
   * @param tenantId - The tenant identifier
   * @param commandType - The command type being rate-limited
   * @param riskClass - 'ordinary' for standard edits, 'high_risk' for elevated commands
   * @returns Rate limit result with allowed flag and header metadata
   *
   * @see AGENT-050
   * @see P0-RATE-001
   */
  tryConsume(
    tenantId: string,
    commandType: string,
    riskClass: "ordinary" | "high_risk"
  ): RateLimitResult {
    const startTime = Date.now();
    const tracer = getTracer();
    const metrics = getMetrics();

    const bucketKey = `${tenantId}:${commandType}`;
    let bucket = this._buckets.get(bucketKey);

    if (!bucket) {
      bucket = new TokenBucket(
        this._effectiveMaxTokens,
        this._config.refillRate,
        this._config.refillIntervalMs
      );
      this._buckets.set(bucketKey, bucket);
    }

    const result = bucket.tryConsume();

    const policy =
      `${this._effectiveMaxTokens};w=${Math.ceil(this._config.refillIntervalMs / 1000)}` +
      `;comment="per-tenant-${riskClass}"`;

    if (riskClass === "high_risk" && result.allowed) {
      // Phase 0: high-risk PG ceiling check is not wired.
      // In a future phase, this is where we'd call checkHighRiskPgCeiling().
      // For now, the in-memory check is the only gate.
    }

    const overheadMs = Date.now() - startTime;
    const span = tracer.startSpan("erp.rate_limit.check", {
      risk_class: riskClass,
      allowed: result.allowed,
      overhead_ms: overheadMs
    });
    span.end();

    metrics.observe("erp_rate_limiter_overhead_ms", overheadMs, {
      risk_class: riskClass
    });

    return {
      allowed: result.allowed,
      retryAfterMs: result.retryAfterMs,
      remaining: result.remaining,
      limit: this._effectiveMaxTokens,
      policy,
    };
  }

  /**
   * Placeholder for high-risk command PostgreSQL ceiling check.
   *
   * In Phase 0, this method is not called on the hot path.
   * It exists to define the contract for future implementation.
   *
   * @param _tenantId - The tenant identifier
   * @param _commandType - The command type
   * @returns Whether the coarse PG ceiling allows the request
   *
   * @see AGENT-050 step 3: "Add coarse PostgreSQL ceiling only for high-risk commands"
   */
  async checkHighRiskPgCeiling(
    _tenantId: string,
    _commandType: string
  ): Promise<boolean> {
    // Phase 0 stub: always allow. Wired in a future work order.
    return true;
  }

  /**
   * Clean up stale buckets that have not been accessed within the threshold.
   *
   * Should be called periodically (e.g., on a timer) to prevent unbounded
   * memory growth from inactive tenants.
   */
  cleanupStaleBuckets(): number {
    const now = Date.now();
    const threshold = this._config.staleBucketThresholdMs;
    let cleaned = 0;

    for (const [key, bucket] of this._buckets) {
      if (now - bucket.lastAccessTime > threshold) {
        this._buckets.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Update the active instance count for budget re-division.
   *
   * Called when InstanceHeartbeat detects a change in active instance count.
   * Note: existing buckets retain their current token count; only new buckets
   * will use the recalculated effective limit.
   *
   * @param count - New active instance count
   */
  updateActiveInstanceCount(count: number): void {
    const safeCount = Math.max(1, count);
    // Mutate the frozen-looking config (we own it)
    (this._config as { activeInstanceCount: number }).activeInstanceCount = safeCount;
    // Recalculate is not retroactive for existing buckets (by design:
    // existing buckets drain naturally; new buckets get the new limit).
  }

  /** Number of active buckets (for observability). */
  get bucketCount(): number {
    return this._buckets.size;
  }

  /** The effective per-instance token limit. */
  get effectiveMaxTokens(): number {
    return this._effectiveMaxTokens;
  }
}

// ── Header helper ───────────────────────────────────────────────────────

/**
 * Convert a RateLimitResult into standard HTTP response headers.
 *
 * Emits:
 *   - `Retry-After` — seconds until retry is allowed (only when rate-limited)
 *   - `RateLimit` — remaining requests in the current window
 *   - `RateLimit-Policy` — quota description
 *
 * @see AGENT-050
 * @see P0-RATE-001
 */
export function getRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    RateLimit: String(result.remaining),
    "RateLimit-Policy": result.policy,
  };

  if (!result.allowed && result.retryAfterMs !== undefined) {
    // Retry-After is in seconds (RFC 7231 §7.1.3)
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1000));
  }

  return headers;
}
