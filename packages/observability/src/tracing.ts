export type SpanAttributes = Record<string, string | number | boolean | undefined>;

export interface SpanLike {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: unknown): void;
  addEvent?(name: string, attributes?: Record<string, any>): void;
  end(): void;
}

export interface TracerLike {
  startSpan(name: string, attributes?: SpanAttributes): SpanLike;
}

export const noopTracer: TracerLike = {
  startSpan() {
    return {
      setAttribute() {},
      recordException() {},
      addEvent() {},
      end() {},
    };
  },
};

export class InMemorySpan implements SpanLike {
  readonly events: Array<{ name: string; timestamp: number; attributes?: Record<string, any> | undefined }> = [];
  readonly exceptions: unknown[] = [];
  readonly attributes: Record<string, string | number | boolean> = {};
  readonly startTime: number;
  endTime?: number;

  constructor(readonly name: string, initialAttributes?: SpanAttributes) {
    this.startTime = Date.now();
    if (initialAttributes) {
      for (const [k, v] of Object.entries(initialAttributes)) {
        if (v !== undefined) {
          this.attributes[k] = v;
        }
      }
    }
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  recordException(error: unknown): void {
    this.exceptions.push(error);
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    this.events.push({ name, timestamp: Date.now(), attributes });
  }

  end(): void {
    this.endTime = Date.now();
  }
}

export class InMemoryTracer implements TracerLike {
  spans: InMemorySpan[] = [];

  startSpan(name: string, attributes?: SpanAttributes): InMemorySpan {
    const span = new InMemorySpan(name, attributes);
    this.spans.push(span);
    return span;
  }

  clear(): void {
    this.spans = [];
  }
}

/**
 * Parsers and helpers for W3C traceparents and fallback IDs.
 */
export function parseOrGenerateTraceContext(traceparent?: string | null): { traceId: string; parentId?: string } {
  if (traceparent) {
    const parts = traceparent.split("-");
    if (parts.length === 4 && parts[0] === "00") {
      const traceId = parts[1];
      const parentId = parts[2];
      if (traceId && traceId.length === 32 && parentId && parentId.length === 16) {
        return { traceId, parentId };
      }
    }
  }

  // Fallback random generation for traceId (32-character hex)
  const chars = "0123456789abcdef";
  let traceId = "";
  for (let i = 0; i < 32; i++) {
    traceId += chars[Math.floor(Math.random() * 16)];
  }
  return { traceId };
}
