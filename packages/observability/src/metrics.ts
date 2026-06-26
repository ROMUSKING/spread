export interface MetricsLike {
  increment(name: string, labels?: Record<string, string>): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
}

export const noopMetrics: MetricsLike = {
  increment() {},
  observe() {},
};

export interface RecordedMetric {
  name: string;
  type: "counter" | "histogram" | "gauge";
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export class InMemoryMetrics implements MetricsLike {
  metrics: RecordedMetric[] = [];

  increment(name: string, labels: Record<string, string> = {}): void {
    this.metrics.push({
      name,
      type: "counter",
      value: 1,
      labels,
      timestamp: Date.now(),
    });
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const isHistogram =
      name.includes("duration") ||
      name.includes("lag") ||
      name.includes("seconds") ||
      name.includes("ms") ||
      name.includes("overhead");

    this.metrics.push({
      name,
      type: isHistogram ? "histogram" : "gauge",
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.metrics = [];
  }
}
