export type RuntimeFeatureFlags = {
  tigerBeetleRuntime: boolean;
  pgvectorRuntime: boolean;
  duckdbRuntime: boolean;
  externalConnectorRuntime: boolean;
  tiledWorkspace: boolean;
};

const runtimeEnv: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env;

export const phase0FeatureFlags: RuntimeFeatureFlags = {
  tigerBeetleRuntime: runtimeEnv.FEATURE_TIGERBEETLE_RUNTIME === "true",
  pgvectorRuntime: runtimeEnv.FEATURE_PGVECTOR_RUNTIME === "true",
  duckdbRuntime: runtimeEnv.FEATURE_DUCKDB_RUNTIME === "true",
  externalConnectorRuntime: runtimeEnv.FEATURE_EXTERNAL_CONNECTOR_RUNTIME === "true",
  tiledWorkspace: runtimeEnv.FEATURE_TILED_WORKSPACE === "true",
};

export function assertPhase0RuntimeFlags(flags = phase0FeatureFlags): void {
  const forbidden = Object.entries(flags).filter(([, enabled]) => enabled).map(([name]) => name);
  if (forbidden.length) {
    throw new Error(`Post-MVP runtime flags are not admitted in Phase 0: ${forbidden.join(", ")}`);
  }
}
