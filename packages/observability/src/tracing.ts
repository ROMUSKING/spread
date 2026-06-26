export type SpanAttributes = Record<string, string | number | boolean | undefined>;

export interface SpanLike {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(error: unknown): void;
  end(): void;
}

export interface TracerLike {
  startSpan(name: string, attributes?: SpanAttributes): SpanLike;
}

export const noopTracer: TracerLike = {
  startSpan() {
    return { setAttribute() {}, recordException() {}, end() {} };
  },
};
