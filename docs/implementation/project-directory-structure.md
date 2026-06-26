# Project Directory Structure

**Version:** 0.16.1  
**Status:** Active Phase 0 runnable repository bootstrap contract

## Purpose

This document defines the implementation-ready monorepo skeleton for human developers and AI coding agents.

## Root layout

```text
repo/
  apps/
    api/                    # command API, command status, outbox polling, SSE, integration staging endpoints
    web/                    # spreadsheet UI shell and command-status client
  packages/
    domain/                 # command, domain, policy, and NumericLedgerPort contracts
    db/                     # migrations, transaction helpers, RLS support, SQL invariant wiring
    contracts/              # shared API/event contracts and generated OpenAPI/AsyncAPI outputs
    config/                 # runtime flags and environment parsing
    observability/          # trace/span/metric wrappers
    testkit/                # evidence URI helpers, fixtures, benchmark helpers
    ui/                     # reusable UI contracts/components after grid DAR
  docs/                     # active documentation and archived release artifacts
  invariants/               # invariant manifests and SQL invariant checks
  tests/                    # test manifest and fixtures
  scripts/                  # pack validation and smoke-test utilities
```

## Stub ownership

| Path | First work order | Rule |
|---|---|---|
| `apps/api/src/commands/CommandHandlerBase.ts` | AGENT-010/011/012 | Preserve command_log/idempotency/transaction boundaries. |
| `apps/api/src/outbox/OutboxPoller.ts` | AGENT-020/021/022 | Poll durable outbox envelopes before payload fetch. |
| `packages/domain/src/ledger/NumericLedgerPort.ts` | AGENT-012 | MVP adapter uses PostgreSQL transaction; TigerBeetle runtime remains post-MVP. |
| `apps/api/src/retrieval/RetrievalRevalidator.middleware.ts` | post-MVP/P1-AI only | Candidates only; fail closed. |
| `apps/web/src/components/GridShell.tsx` | AGENT-060 | Edits route through command_api only. |

## Runnable bootstrap requirement

The repository skeleton must pass:

```bash
bash scripts/smoke-typecheck.sh
```

The smoke typecheck uses `tsconfig.smoke.json` and verifies the active source stubs under `apps/` and `packages/`. It does not admit post-MVP runtime dependencies.

## Documentation relocation policy

- Active docs stay under `docs/` by category.
- Historical changelogs are under `docs/archive/changelog/`.
- Historical validation/health/zip artifacts are under `docs/archive/release-artifacts/`.
- Older active specs are under `docs/archive/spec/`.
- Older snapshots are under `docs/archive/snapshot/`.
- Source-code stubs live in `apps/` and `packages/`; `docs/skeletons/` is now an index to those stubs.

## Agent rule

Do not create a new top-level app or package without updating this document, `pnpm-workspace.yaml`, `docs/tech-stack-decisions.md`, `tsconfig.smoke.json`, and `scripts/validate-pack.sh`.


## Generated artifact policy

Generated `dist/`, generated declaration outputs, and `*.tsbuildinfo` files are not part of the source bootstrap archive. Hand-written ambient declaration shims may remain under `src/` when required for smoke typecheck. Generated outputs are ignored by `.gitignore` and rejected by `scripts/validate-pack.sh`.


## v0.16.1 package smoke tests

```bash
bash scripts/smoke-package-tests.sh
```

Every workspace package contains `test/smoke.test.mjs`. These tests are dependency-free and prove package metadata and required bootstrap source stubs exist.
