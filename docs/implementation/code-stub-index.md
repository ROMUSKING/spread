# Code Stub Index

**Version:** 0.17.0  
**Status:** Active stub map for AI coding agents

| Boundary | Stub path | Canonical docs |
|---|---|---|
| Command execution | `apps/api/src/commands/CommandHandlerBase.ts` | `docs/dev/command-lifecycle.md` |
| Outbox polling | `apps/api/src/outbox/OutboxPoller.ts` | `docs/dev/outbox-polling-reader.md`, `docs/data/outbox-polling-performance-contract.md` |
| Numeric ledger port | `packages/domain/src/ledger/NumericLedgerPort.ts` | `docs/data/numeric-ledger-contract.md` |
| Retrieval revalidation | `apps/api/src/retrieval/RetrievalRevalidator.middleware.ts` | `docs/dev/retrieval-revalidator.md` |
| Minimal grid shell | `apps/web/src/components/GridShell.tsx` | `docs/ui/transposed-record-view-contract.md`, `docs/dev/client-optimistic-ui-and-conflicts.md` |
| Runtime feature flags | `packages/config/src/env.ts` | `docs/post-mvp/post-mvp-planes-vnext.md` |
| Smoke typecheck | `scripts/smoke-typecheck.sh`, `tsconfig.smoke.json` | `docs/qa/repository-smoke-test-v0.17.0.md` |
| Batch partition policy | `workbooks/*/batch-partition-policy.yml` + `packages/domain/src/policies/BatchPartitionCompiler.ts:compilePartitions` | `docs/dev/batch-partition-policy.md`, `docs/data/pilot-dataset-definition.md` (ecom contracts) |
| Domain workbook contracts (logical, Phase 0) | `docs/data/pilot-dataset-definition.md` (ecom subsection) + `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md` | `docs/data/schema-evolution-playbook.md` |
| Domain command handlers (ecom basics) | `apps/api/src/commands/handlers/InventoryHandlers.ts`, `SalesHandlers.ts` (extend CommandHandlerBase) | sme-ecommerce-domain-model-and-business-logic-spec.md (payloads + logic) |

These stubs are allowed starting points only. They must be made production-safe through the relevant work order and gate evidence.

`docs/skeletons/` must not contain duplicate TypeScript source copies; it is only a documentation index.


## v0.17.0 package smoke tests

```bash
bash scripts/smoke-package-tests.sh
```

Every workspace package contains `test/smoke.test.mjs`. These tests are dependency-free and prove package metadata and required bootstrap source stubs exist.
