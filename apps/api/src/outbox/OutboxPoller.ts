import type { OutboxEnvelope } from "@erp/contracts/events";
import type { MetricsLike } from "@erp/observability/metrics";

export type LocalSubscriptionIndex = {
  tenantIds: Set<string>;
  workbookIdsByTenant: Map<string, Set<string>>;
};

export type OutboxStore = {
  fetchEnvelopeBatch(args: { afterOutboxId: string; tenantIds: readonly string[]; limit: number }): Promise<OutboxEnvelope[]>;
  fetchPayload(eventId: string): Promise<unknown>;
};

export type OutboxPollerOptions = {
  maxEventsPerPoll: number;
  maxBytesPerPoll: number;
};

export class OutboxPoller {
  constructor(private readonly store: OutboxStore, private readonly metrics: MetricsLike, private readonly options: OutboxPollerOptions) {}

  async pollOnce(highWatermark: string, subscriptions: LocalSubscriptionIndex): Promise<{ nextHighWatermark: string; events: OutboxEnvelope[]; syncRequired: boolean }> {
    const tenantIds = [...subscriptions.tenantIds];
    if (tenantIds.length === 0) return { nextHighWatermark: highWatermark, events: [], syncRequired: false };

    const envelopes = await this.store.fetchEnvelopeBatch({ afterOutboxId: highWatermark, tenantIds, limit: this.options.maxEventsPerPoll });
    let bytes = 0;
    const deliverable: OutboxEnvelope[] = [];

    for (const event of envelopes) {
      const subscribedWorkbooks = subscriptions.workbookIdsByTenant.get(event.tenantId);
      if (event.workbookId && subscribedWorkbooks && !subscribedWorkbooks.has(event.workbookId)) continue;
      bytes += JSON.stringify(event).length;
      if (bytes > this.options.maxBytesPerPoll) return { nextHighWatermark: highWatermark, events: deliverable, syncRequired: true };
      deliverable.push(event);
    }

    const nextHighWatermark = envelopes.at(-1)?.outboxId ?? highWatermark;
    this.metrics.observe("outbox_poll_envelopes", envelopes.length);
    return { nextHighWatermark, events: deliverable, syncRequired: false };
  }
}
