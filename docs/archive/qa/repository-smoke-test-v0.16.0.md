# Repository Smoke Test v0.16.0

**Version:** 0.16.0  
**Status:** Required bootstrap evidence contract

## Required commands

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
```

## Scope

The smoke test proves that:

```text
- the active spec, snapshot, manifest, invariants, and SLOs agree on v0.16.0;
- implementation stubs live in apps/ and packages/;
- no generated dist/, generated .d.ts, or tsbuildinfo files are included;
- TypeScript stubs compile under tsconfig.smoke.json;
- post-MVP runtime flags remain disabled by default.
```

## Non-goals

```text
- no database migrations are applied;
- no PostgreSQL, TigerBeetle, pgvector, DuckDB, broker, CDC, or connector runtime is started;
- no production dependencies are admitted by the smoke test.
```

## Evidence URIs

```text
ci://tests/process/repo-smoke-typecheck-passes
ci://benchmarks/BENCH-REPO-002
```
