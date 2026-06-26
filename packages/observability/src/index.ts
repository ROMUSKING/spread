import type { TracerLike } from "./tracing.js";
import { noopTracer } from "./tracing.js";
import type { MetricsLike } from "./metrics.js";
import { noopMetrics } from "./metrics.js";

export * from "./tracing.js";
export * from "./metrics.js";

let activeTracer: TracerLike = noopTracer;
let activeMetrics: MetricsLike = noopMetrics;

export function getTracer(): TracerLike {
  return activeTracer;
}

export function setTracer(tracer: TracerLike): void {
  activeTracer = tracer;
}

export function getMetrics(): MetricsLike {
  return activeMetrics;
}

export function setMetrics(metrics: MetricsLike): void {
  activeMetrics = metrics;
}
