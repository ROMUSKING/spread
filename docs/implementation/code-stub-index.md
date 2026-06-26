# Code Stub Index

**Version:** 0.16.1  
**Status:** Active stub map for AI coding agents

| Boundary | Stub path | Canonical docs |
|---|---|---|
| Command execution | `apps/api/src/commands/CommandHandlerBase.ts` | `docs/dev/command-lifecycle.md` |
| Outbox polling | `apps/api/src/outbox/OutboxPoller.ts` | `docs/dev/outbox-polling-reader.md`, `docs/data/outbox-polling-performance-contract.md` |
| Numeric ledger port | `packages/domain/src/ledger/NumericLedgerPort.ts` | `docs/data/numeric-ledger-contract.md` |
| Retrieval revalidation | `apps/api/src/retrieval/RetrievalRevalidator.middleware.ts` | `docs/dev/retrieval-revalidator.md` |
| Minimal grid shell | `apps/web/src/components/GridShell.tsx` | `docs/ui/transposed-record-view-contract.md`, `docs/dev/client-optimistic-ui-and-conflicts.md` |
| Runtime feature flags | `packages/config/src/env.ts` | `docs/post-mvp/post-mvp-planes-vnext.md` |
| Smoke typecheck | `scripts/smoke-typecheck.sh`, `tsconfig.smoke.json` | `docs/qa/repository-smoke-test-v0.16.1.md` |

These stubs are allowed starting points only. They must be made production-safe through the relevant work order and gate evidence.

`docs/skeletons/` must not contain duplicate TypeScript source copies; it is only a documentation index.


## v0.16.1 package smoke tests

```bash
bash scripts/smoke-package-tests.sh
```

Every workspace package contains `test/smoke.test.mjs`. These tests are dependency-free and prove package metadata and required bootstrap source stubs exist.
