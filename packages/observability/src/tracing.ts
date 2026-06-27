import crypto from "node:crypto";

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
  const isValidLowerHex = (value: string, length: number): boolean =>
    value.length === length && /^[0-9a-f]+$/.test(value);

  const isAllZeros = (value: string): boolean => /^0+$/.test(value);

  if (traceparent) {
    const parts = traceparent.split("-");
    if (parts.length === 4) {
      const version = parts[0];
      const traceId = parts[1];
      const parentId = parts[2];

      if (
        version &&
        version !== "ff" &&
        isValidLowerHex(version, 2) &&
        traceId &&
        isValidLowerHex(traceId, 32) &&
        !isAllZeros(traceId) &&
        parentId &&
        isValidLowerHex(parentId, 16) &&
        !isAllZeros(parentId) &&
        parts[3] &&
        isValidLowerHex(parts[3], 2)
      ) {
        return { traceId, parentId };
      }
    }
  }

  // Fallback random generation for traceId (32-character hex)
  let traceId = "";
  while (!traceId || isAllZeros(traceId)) {
    traceId = crypto.randomBytes(16).toString("hex");
  }

  return { traceId };
}
