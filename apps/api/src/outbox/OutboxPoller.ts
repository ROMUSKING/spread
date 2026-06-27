/**
 * AGENT-021 — Outbox Poller
 *
 * Implements the two-stage outbox polling pattern with comprehensive observability.
 *
 * @see docs/dev/outbox-polling-reader.md
 * @see docs/data/outbox-polling-performance-contract.md
 */
import crypto from 'crypto';
import type { OutboxEnvelope } from '@erp/contracts/events';
import type { MetricsLike } from '@erp/observability/metrics';
import {
  serializeOutboxPayload,
  type OutboxRepository,
} from './OutboxRepository';
import { getTracer } from '@erp/observability';

function hashId(id?: string): string {
  if (!id) return '';
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 12);
}

export type LocalSubscriptionIndex = {
  tenantIds: Set<string>;
  workbookIdsByTenant: Map<string, Set<string>>;
};

export type OutboxPollerOptions = {
  maxEventsPerPoll: number;
  maxBytesPerPoll: number; // e.g. 2 MiB budget
};

export type OutboxSyncTarget = {
  tenantId: string;
  workbookId?: string | undefined;
};

export type OutboxPollResult = {
  nextHighWatermark: string;
  events: OutboxEnvelope[];
  syncRequired: boolean;
  syncTargets?: OutboxSyncTarget[];
  syncMinOutboxId?: string;
};

export class OutboxPoller {
  private readonly repo: OutboxRepository;
  private readonly metrics: MetricsLike;
  private readonly options: OutboxPollerOptions;

  constructor(
    repo: OutboxRepository,
    metrics: MetricsLike,
    options: OutboxPollerOptions,
  ) {
    this.repo = repo;
    this.metrics = metrics;
    this.options = options;
  }

  /**
   * Run a single poll cycle.
   *
   * @param highWatermark The current monotonic outbox_id watermark
   * @param subscriptions The active tenant/workbook subscription index
   */
  async pollOnce(
    highWatermark: string,
    subscriptions: LocalSubscriptionIndex,
  ): Promise<OutboxPollResult> {
    const startTime = Date.now();
    if (!highWatermark) {
      throw new Error('ASSERT_FAILED: highWatermark required');
    }
    const tenantIds = [...subscriptions.tenantIds];
    if (tenantIds.length === 0) {
      return {
        nextHighWatermark: highWatermark,
        events: [],
        syncRequired: false,
      };
    }

    const tracer = getTracer();
    const pollSpan = tracer.startSpan('erp.outbox.poll', {
      last_watermark: highWatermark,
      events_seen: 0,
      events_delivered: 0,
      bytes_fetched: 0,
    });

    // 1. Retention Gap Detection
    const minOutboxId = await this.repo.getMinOutboxId();
    if (
      minOutboxId !== null &&
      highWatermark !== '0' &&
      BigInt(highWatermark) < BigInt(minOutboxId)
    ) {
      this.metrics.increment('erp_outbox_retention_gap_total');
      this.metrics.increment('erp_outbox_full_refresh_required_total');

      const decisionSpan = tracer.startSpan(
        'erp.outbox.full_refresh_decision',
        {
          reason: 'retention_gap',
          workbook_id_hash: '',
          watermark: highWatermark,
          payload_bytes: 0,
          schema_version: 1,
        },
      );
      decisionSpan.end();

      pollSpan.setAttribute('events_seen', 0);
      pollSpan.setAttribute('events_delivered', 0);
      pollSpan.setAttribute('bytes_fetched', 0);
      pollSpan.end();

      return {
        nextHighWatermark: highWatermark,
        events: [],
        syncRequired: true,
        syncMinOutboxId: minOutboxId,
      };
    }

    // 2. Stage 1: Fetch envelope metadata only
    const sqlStart = Date.now();
    const pollSqlSpan = tracer.startSpan('erp.outbox.poll_sql', {
      'erp.last_watermark': highWatermark,
      'erp.rows_returned': 0,
      'erp.duration_ms': 0,
      'erp.plan_hash': 'idx_only_scan_poll',
      'erp.seq_scan_detected': false,
      last_watermark: highWatermark,
      tenant_count: tenantIds.length,
      limit: this.options.maxEventsPerPoll,
      rows_returned: 0,
      duration_ms: 0,
      plan_hash: 'idx_only_scan_poll',
      seq_scan_detected: false,
    });

    let envelopes;
    try {
      envelopes = await this.repo.fetchEnvelopeMetadataBatch({
        afterOutboxId: highWatermark,
        tenantIds,
        limit: this.options.maxEventsPerPoll,
      });
    } finally {
      const sqlDurationMs = Date.now() - sqlStart;
      this.metrics.observe('erp_outbox_poll_sql_seconds', sqlDurationMs / 1000);
      pollSqlSpan.setAttribute(
        'erp.rows_returned',
        envelopes ? envelopes.length : 0,
      );
      pollSqlSpan.setAttribute('erp.duration_ms', sqlDurationMs);
      pollSqlSpan.setAttribute(
        'rows_returned',
        envelopes ? envelopes.length : 0,
      );
      pollSqlSpan.setAttribute('duration_ms', sqlDurationMs);
      pollSqlSpan.end();
    }

    this.metrics.observe(
      'erp_outbox_envelope_rows_scanned_total',
      envelopes.length,
    );

    if (envelopes.length === 0) {
      const cycleDuration = (Date.now() - startTime) / 1000;
      this.metrics.observe('erp_outbox_poll_cycle_seconds', cycleDuration);
      pollSpan.setAttribute('events_seen', 0);
      pollSpan.setAttribute('events_delivered', 0);
      pollSpan.setAttribute('bytes_fetched', 0);
      pollSpan.end();
      return {
        nextHighWatermark: highWatermark,
        events: [],
        syncRequired: false,
      };
    }

    // 3. Demand filtering & budget check
    const demandSpan = tracer.startSpan('erp.outbox.demand_filter', {
      events_seen: envelopes.length,
      events_deliverable: 0,
      events_skipped_no_local_subscriber: 0,
      payload_bytes_planned: 0,
    });

    const deliverableMetadata: typeof envelopes = [];
    let accumulatedBytes = 0;
    let nextWatermark = highWatermark;
    let budgetBreached = false;
    let skippedNoLocalSubscriber = 0;

    for (const env of envelopes) {
      // Advance watermark to current processed item
      nextWatermark = env.outboxId;

      // Filter by plane: only target "sse" plane
      if (!env.targetPlanes.includes('sse')) {
        skippedNoLocalSubscriber++;
        continue;
      }

      // Filter by workbook subscription demand
      const subscribedWorkbooks = subscriptions.workbookIdsByTenant.get(
        env.tenantId,
      );
      if (
        env.workbookId &&
        (!subscribedWorkbooks || !subscribedWorkbooks.has(env.workbookId))
      ) {
        skippedNoLocalSubscriber++;
        continue;
      }

      // Byte budget enforcement
      if (
        accumulatedBytes + env.payloadSizeBytes >
        this.options.maxBytesPerPoll
      ) {
        budgetBreached = true;
        // Rollback nextWatermark to the previous item's outboxId so we resume from here next time
        const index = envelopes.findIndex((e) => e.outboxId === env.outboxId);
        if (index > 0) {
          nextWatermark = envelopes[index - 1]!.outboxId;
        } else {
          nextWatermark = highWatermark;
        }
        break;
      }

      accumulatedBytes += env.payloadSizeBytes;
      deliverableMetadata.push(env);
    }

    demandSpan.setAttribute('events_deliverable', deliverableMetadata.length);
    demandSpan.setAttribute(
      'events_skipped_no_local_subscriber',
      skippedNoLocalSubscriber,
    );
    demandSpan.setAttribute('payload_bytes_planned', accumulatedBytes);
    demandSpan.end();

    if (budgetBreached) {
      this.metrics.increment('erp_outbox_full_refresh_required_total');

      const decisionSpan = tracer.startSpan(
        'erp.outbox.full_refresh_decision',
        {
          reason: 'byte_budget_breached',
          workbook_id_hash: envelopes[deliverableMetadata.length]?.workbookId
            ? hashId(envelopes[deliverableMetadata.length]!.workbookId)
            : '',
          watermark: nextWatermark,
          payload_bytes: accumulatedBytes,
          schema_version: 1,
        },
      );
      decisionSpan.end();

      const cycleDuration = (Date.now() - startTime) / 1000;
      this.metrics.observe('erp_outbox_poll_cycle_seconds', cycleDuration);

      pollSpan.setAttribute('events_seen', envelopes.length);
      pollSpan.setAttribute('events_delivered', 0);
      pollSpan.setAttribute('bytes_fetched', 0);
      pollSpan.end();

      return {
        nextHighWatermark: nextWatermark,
        events: [],
        syncRequired: true,
        ...(envelopes[deliverableMetadata.length]
          ? {
              syncTargets: [
                {
                  tenantId: envelopes[deliverableMetadata.length]!.tenantId,
                  workbookId: envelopes[deliverableMetadata.length]!.workbookId,
                },
              ],
            }
          : {}),
      };
    }

    // 4. Stage 2: Fetch payloads only for deliverable events
    const deliverableIds = deliverableMetadata.map((e) => e.outboxId);
    let payloadRows: Array<{
      outboxId: string;
      payload: unknown;
      payloadHash: string;
      payloadRef?: string;
    }> = [];

    if (deliverableIds.length > 0) {
      const payloadSqlStart = Date.now();
      const payloadFetchSpan = tracer.startSpan('erp.outbox.payload_fetch', {
        event_count: deliverableIds.length,
        payload_bytes: accumulatedBytes,
        payload_ref_count: 0,
        duration_ms: 0,
      });

      try {
        payloadRows = await this.repo.fetchPayloads(deliverableIds);
      } finally {
        const payloadDuration = Date.now() - payloadSqlStart;
        this.metrics.observe(
          'erp_outbox_poll_sql_seconds',
          payloadDuration / 1000,
        );
        this.metrics.observe(
          'erp_outbox_payload_bytes_fetched_total',
          accumulatedBytes,
        );

        let refCount = 0;
        for (const row of payloadRows) {
          if (row.payloadRef) refCount++;
        }

        payloadFetchSpan.setAttribute('payload_ref_count', refCount);
        payloadFetchSpan.setAttribute('duration_ms', payloadDuration);
        payloadFetchSpan.end();
      }
    }

    const payloadMap = new Map<string, (typeof payloadRows)[number]>();
    for (const row of payloadRows) {
      payloadMap.set(row.outboxId, row);
    }

    // 5. Payload hash validation & assembly
    const fullEvents: OutboxEnvelope[] = [];
    let payloadRefsCount = 0;

    for (const meta of deliverableMetadata) {
      const payloadRow = payloadMap.get(meta.outboxId);
      if (!payloadRow) {
        throw new Error(
          `Data integrity breach: Payload missing for outbox_id ${meta.outboxId}`,
        );
      }

      // Hash verification
      const serialized = serializeOutboxPayload(payloadRow.payload) ?? 'null';
      const calculatedHash = crypto
        .createHash('sha256')
        .update(serialized)
        .digest('hex');

      if (calculatedHash !== meta.payloadHash) {
        this.metrics.increment('erp_outbox_hash_mismatch_total');
        console.error(
          `SECURITY ALERT: Payload hash mismatch for outbox_id ${meta.outboxId}. Delivery blocked.`,
        );

        pollSpan.setAttribute('events_seen', envelopes.length);
        pollSpan.setAttribute('events_delivered', fullEvents.length);
        pollSpan.setAttribute('bytes_fetched', accumulatedBytes);
        pollSpan.end();

        return {
          nextHighWatermark: meta.outboxId,
          events: fullEvents,
          syncRequired: true,
          syncTargets: [
            {
              tenantId: meta.tenantId,
              workbookId: meta.workbookId,
            },
          ],
        };
      }

      if (payloadRow.payloadRef) {
        payloadRefsCount++;
      }

      fullEvents.push({
        ...meta,
        payload: payloadRow.payload,
        payloadRef: payloadRow.payloadRef,
      });
    }

    // Record payload ref ratio
    if (fullEvents.length > 0) {
      this.metrics.observe(
        'erp_outbox_payload_ref_ratio',
        payloadRefsCount / fullEvents.length,
      );
    }

    this.metrics.increment('erp_outbox_events_polled_total', {
      instance: 'default-instance',
      event_type: envelopes[0]?.eventType || 'unknown',
    });

    const cycleDuration = (Date.now() - startTime) / 1000;
    this.metrics.observe('erp_outbox_poll_cycle_seconds', cycleDuration);

    // Compute lag: time between oldest outbox event creation and now
    if (envelopes.length > 0) {
      const oldestEventTime = new Date(envelopes[0]!.createdAt).getTime();
      const lagSeconds = (Date.now() - oldestEventTime) / 1000;
      this.metrics.observe('erp_outbox_poll_lag_seconds', lagSeconds, {
        instance: 'default-instance',
        tenant_region: 'default-region',
      });
    }

    pollSpan.setAttribute('events_seen', envelopes.length);
    pollSpan.setAttribute('events_delivered', fullEvents.length);
    pollSpan.setAttribute('bytes_fetched', accumulatedBytes);
    pollSpan.end();

    return {
      nextHighWatermark: nextWatermark,
      events: fullEvents,
      syncRequired: false,
    };
  }
}
