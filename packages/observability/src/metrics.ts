export interface MetricsLike {
  increment(name: string, labels?: Record<string, string>): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
}

export const noopMetrics: MetricsLike = {
  increment() {},
  observe() {},
};
