# Repository Smoke Test v0.17.0

**Version:** 0.17.0  
**Status:** Required bootstrap evidence contract

## Required commands

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
bash scripts/smoke-package-tests.sh
```

## Scope

The smoke checks prove that:

```text
- active spec, snapshot, manifest, invariants, package metadata, and SLOs agree on v0.17.0;
- implementation stubs live in apps/ and packages/;
- no generated dist/, generated .d.ts, emitted source JS, or tsbuildinfo files are included;
- TypeScript stubs compile under tsconfig.smoke.json;
- every workspace package has a dependency-free smoke test;
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
ci://tests/process/package-smoke-tests-pass
ci://benchmarks/BENCH-REPO-002
ci://benchmarks/BENCH-REPO-003
```
