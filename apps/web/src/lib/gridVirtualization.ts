import type { GridRow } from "../components/SpreadsheetGrid";

/** Row count above which SpreadsheetGrid switches to react-window virtualization. */
export const VIRTUALIZATION_THRESHOLD = 50;

/** Fixed virtual row height (px); matches comfortable-density cell padding. */
export const VIRTUAL_ROW_HEIGHT = 33;

/** BENCH-UX-001 target dataset size. */
export const BENCH_UX_001_ROW_COUNT = 100_000;

/** Maximum acceptable ms to project a virtual window across 100k rows (dev hardware). */
export const BENCH_UX_001_MAX_MS = 500;

const VIRTUAL_WINDOW_SIZE = 24;

/**
 * Simulates repeated virtual-window projection for BENCH-UX-001 evidence.
 * Only materializes small slices — same strategy react-window uses at runtime.
 */
export function projectVirtualWindow(
  rows: GridRow[],
  windowSize = VIRTUAL_WINDOW_SIZE
): number {
  let touched = 0;
  for (let start = 0; start < rows.length; start += windowSize) {
    const slice = rows.slice(start, start + windowSize);
    for (const row of slice) {
      touched += Object.keys(row.values).length;
    }
  }
  return touched;
}

export function buildSyntheticRows(count: number): GridRow[] {
  return Array.from({ length: count }, (_, index) => ({
    rowId: String(index + 1),
    values: {
      item_name: `Item ${index + 1}`,
      quantity: String((index % 9) + 1),
      unit_price: String(((index % 50) + 1) * 10),
      total: String(((index % 9) + 1) * (((index % 50) + 1) * 10)),
    },
  }));
}

export function runBenchUx001Projection(
  rowCount = BENCH_UX_001_ROW_COUNT
): { rowCount: number; elapsedMs: number; passed: boolean; cellsTouched: number } {
  const rows = buildSyntheticRows(rowCount);
  const start = performance.now();
  const cellsTouched = projectVirtualWindow(rows);
  const elapsedMs = performance.now() - start;
  return {
    rowCount,
    elapsedMs,
    passed: elapsedMs <= BENCH_UX_001_MAX_MS,
    cellsTouched,
  };
}

export function shouldVirtualizeGrid(rowCount: number): boolean {
  return rowCount >= VIRTUALIZATION_THRESHOLD;
}