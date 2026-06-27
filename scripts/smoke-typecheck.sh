#!/usr/bin/env bash
set -euo pipefail

# Bootstrap typecheck only proves that the Phase 0 TypeScript stubs are coherent.
# It intentionally does not start PostgreSQL, TigerBeetle, pgvector, DuckDB, brokers,
# CDC workers, external connector runtimes, or the full web application.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf 'TypeScript smoke typecheck for Spreadsheet-Native ERP v0.17.0\n'

TSC_CMD=()
if [[ -x "node_modules/.bin/tsc" ]]; then
  TSC_CMD=("node_modules/.bin/tsc")
elif command -v pnpm >/dev/null 2>&1 && pnpm exec tsc -v >/dev/null 2>&1; then
  TSC_CMD=(pnpm exec tsc)
elif command -v tsc >/dev/null 2>&1; then
  TSC_CMD=(tsc)
else
  cat >&2 <<'ERR'
tsc is required for the bootstrap smoke typecheck.
Resolution order: local node_modules/.bin/tsc -> pnpm exec tsc -> global tsc.
For a fresh clone, run the package-manager bootstrap once a lockfile exists, or install TypeScript globally for local smoke validation.
ERR
  exit 1
fi

"${TSC_CMD[@]}" -p tsconfig.smoke.json --noEmit --pretty false
printf 'TypeScript smoke typecheck passed.\n'
