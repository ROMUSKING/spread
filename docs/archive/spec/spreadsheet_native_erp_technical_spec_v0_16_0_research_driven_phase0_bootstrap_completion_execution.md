# Spreadsheet-Native ERP Technical Specification v0.16.0

**Date:** 2026-06-26  
**Status:** Phase 0 bootstrap-completion baseline for AI-agent and human implementation  
**Supersedes:** v0.16.0 project-structure bootstrap baseline  
**Version note:** This is **v0.16.0**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, AI coding agents, reviewers, QA, SRE, security, compliance, product, and domain owners.

## 1. Executive Summary

v0.16.0 declares the repository bootstrap complete enough for real Phase 0 work-order execution. It does not expand product scope. It promotes the v0.16.0 monorepo skeleton into a runnable bootstrap with repository smoke checks, a clearer first-read snapshot, explicit source-stub ownership, and final active-version cleanup.

The core product thesis remains unchanged: build a TypeScript-first, PostgreSQL-backed, spreadsheet-native ERP where every visible cell is a permissioned, validated, auditable projection of normalized business data.

The Phase 0 deliverable remains one safe cell edit:

```text
command identity
  -> current/audit/domain/outbox transaction
  -> polling-first SSE delivery
  -> command-status recovery
  -> invariant evidence
```

Do not introduce TigerBeetle, pgvector, DuckDB, CDC, broker fan-out, external connector runtime, full tiled UI, or AI-generated mutations into the ordinary Phase 0 edit path.

## 2. v0.16.0 Bootstrap Completion Additions

| Area | v0.16.0 state | v0.16.0 refinement |
|---|---|---|
| Repository structure | Concrete monorepo skeleton existed. | Structure is now backed by a runnable repository smoke script and validation wiring. |
| Code skeletons | Implementation-path stubs existed, with compatibility index under `docs/skeletons/`. | `docs/skeletons/` is explicitly an index only; validation rejects duplicate TypeScript skeleton files there. |
| Snapshot | First-read snapshot existed. | Snapshot now includes a top-level authority map, agent no-go checklist, and Mermaid repository tree. |
| Validation | Checked structure and stubs. | Validation now runs repository smoke checks and fails on stale active v0.15.x references in live entrypoints. |
| Documentation hygiene | Historical artifacts were partially archived. | Active docs are v0.16.0; historical reviews/changelogs/specs/snapshots live under `docs/archive/`. |

## 3. START HERE Contract

Every contributor and coding agent must start with:

```text
docs/snapshot-v0.16.0.md
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
docs/implementation/project-directory-structure.md
```

The snapshot is intentionally short. It is the first-read contract for authority boundaries, repository shape, locked gate order, and current non-goals.

## 4. Repository Shape

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
  docs/
  invariants/
  tests/
  scripts/
```

The normative directory contract is:

```text
docs/implementation/project-directory-structure.md
```

## 5. Stub Boundaries

| Boundary | Active stub |
|---|---|
| Command execution | `apps/api/src/commands/CommandHandlerBase.ts` |
| Outbox polling | `apps/api/src/outbox/OutboxPoller.ts` |
| Numeric ledger adapter | `packages/domain/src/ledger/NumericLedgerPort.ts` |
| Retrieval revalidation | `apps/api/src/retrieval/RetrievalRevalidator.middleware.ts` |
| Minimal grid shell | `apps/web/src/components/GridShell.tsx` |
| Runtime feature flags | `packages/config/src/env.ts` |

These stubs are allowed starting points only. They must be made production-safe through the relevant work order and gate evidence.

## 6. Repository Smoke Contract

v0.16.0 adds a dependency-light smoke check:

```bash
node scripts/repo-smoke.mjs
```

The root package exposes:

```bash
pnpm run smoke
pnpm run typecheck:stubs
pnpm run ci:bootstrap
```

The smoke check is intentionally not a substitute for real TypeScript typechecking after dependencies are installed. It verifies that the bootstrap structure, package scripts, implementation stubs, agent instructions, and active snapshot/spec pointers are coherent without requiring network access.

## 7. Locked Phase 0 Product Order

```text
P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001
```

`P0-EXEC-001` governs agent execution and review hygiene. It does not reorder product work.

## 8. Authority Boundaries

All mutations use the command layer. A successful edit must atomically create or update:

```text
command_log
current-state business row(s)
audit_events
domain_events
outbox_events
terminal command status
```

For MVP, `PostgresMvpNumericLedgerAdapter` participates in the same PostgreSQL transaction when numeric movement scaffolding is touched. Post-MVP TigerBeetle calls remain outside Phase 0 edit-path scope and are described only as a future adapter boundary.

## 9. Post-MVP Runtimes Remain Excluded

| Plane | Phase 0 status | Post-MVP role |
|---|---|---|
| TigerBeetle | Adapter scaffolding only; no runtime dependency in edit path. | Conserved numeric ledger plane after P1-LEDGER evidence. |
| pgvector | Schema/readiness concepts only. | Permissioned semantic retrieval over revalidated chunks. |
| DuckDB | Export/readiness concepts only. | Derived analytics over governed snapshots. |
| CDC/broker fan-out | Envelope/readiness concepts only. | Outbox fan-out after P1-OUTBOX evidence. |
| External integrations | Staging contract and synthetic fixtures only. | Governed adapters after P1-INTEGRATION evidence. |
| Tiled UI | Metadata hooks and command-safe transpose only. | Tiled workspace after vertical slice and P1-UX evidence. |

Detailed post-MVP design lives in:

```text
docs/post-mvp/post-mvp-planes-vnext.md
```

## 10. Validation

Default validation remains strict:

```bash
bash scripts/validate-pack.sh
```

The validator checks active spec uniqueness, YAML duplicate keys, active required docs, project skeleton presence, scoped agent instructions, source stubs, repository smoke output, and release-blocking architecture boundaries.

## 11. Phase 0 Definition of Done

Phase 0 is complete only when:

```text
1. Single safe cell edit persists command_log, current-state change, audit_event, domain_event, and outbox_event.
2. Unknown-outcome recovery passes TC-CMD-001.
3. Outbox polling delivers live updates without NOTIFY.
4. NOTIFY benchmark either passes and is admitted, or remains disabled.
5. Security invariant manifest runs in CI.
6. Transactional-batch policy compiler fails closed on hidden dependencies.
7. Hot-path edit rate limiting avoids synchronous PostgreSQL counters.
8. Minimal grid edit UI routes edits through command_api and exposes command status.
9. P0-EXEC-001 evidence shows agents follow snapshot, stubs, and validation requirements.
10. Owner sign-offs are recorded for non-waivable P0 gates.
```

## 12. Final v0.16.0 Recommendation

Proceed from bootstrap into real implementation work orders:

```text
AGENT-000 -> AGENT-001 -> AGENT-010 -> AGENT-011 -> AGENT-012
```

Do not start broad UI, post-MVP plane runtime, connector runtime, formula breadth, imports/exports, or advanced workflow work before the safe-cell-edit vertical slice is green.
