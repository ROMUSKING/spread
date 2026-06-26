# Spreadsheet-Native ERP Technical Specification v0.15.3

**Date:** 2026-06-26  
**Status:** Phase 0 implementation-readiness baseline with AI coding-agent execution roadmap, project directory skeleton, source stubs, scoped agent instructions, and repository hygiene  
**Supersedes:** v0.15.2 AI coding-agent delivery-polish baseline  
**Version note:** This is **v0.15.3**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, AI coding agents, reviewers, QA, SRE, security, compliance, product, and domain owners.

## 1. Executive Summary

v0.15.3 converts the v0.15.2 documentation and agent-execution pack into an implementation-ready repository skeleton. It adds a TypeScript-first pnpm workspace, source-code stubs, scoped agent instruction files, `.gitignore`, environment examples, and a project directory contract.

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

## 2. v0.15.3 Project Bootstrap Additions

| Area | v0.15.2 state | v0.15.3 refinement |
|---|---|---|
| Repository structure | Documented as planned shape. | Created actual `apps/` and `packages/` skeleton. |
| Code skeletons | Lived under `docs/skeletons/*.ts`. | Moved into implementation paths with `docs/skeletons/README.md` as compatibility index. |
| Tooling | Documentation-only. | Added root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.env.example`, and `.gitignore`. |
| Agent instructions | Root `AGENTS.md`. | Added scoped `AGENTS.md` files and Copilot/Cursor/Claude/Windsurf pointers. |
| Documentation layout | Several root changelogs and release artifacts. | Historical materials moved under `docs/archive/`; active docs remain in `docs/`. |
| Validation | Checked documentation pack health. | Now also checks repository structure, stubs, agent instruction files, and project hygiene. |

## 3. Repository Shape

```text
repo/
  apps/
    api/                    # command API, outbox polling, SSE, integration staging endpoints
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

## 4. Stub Boundaries

| Boundary | Active stub |
|---|---|
| Command execution | `apps/api/src/commands/CommandHandlerBase.ts` |
| Outbox polling | `apps/api/src/outbox/OutboxPoller.ts` |
| Numeric ledger adapter | `packages/domain/src/ledger/NumericLedgerPort.ts` |
| Retrieval revalidation | `apps/api/src/retrieval/RetrievalRevalidator.middleware.ts` |
| Minimal grid shell | `apps/web/src/components/GridShell.tsx` |
| Runtime feature flags | `packages/config/src/env.ts` |

These are stubs, not full implementations. They exist to give AI coding agents correct boundary shapes before AGENT-010 through AGENT-090 are executed.

## 5. Locked Phase 0 Product Order

```text
P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001
```

`P0-EXEC-001` governs agent execution and review hygiene. It does not reorder product work.

## 6. Authority Boundaries

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

## 7. Post-MVP Runtimes Remain Excluded

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

## 8. Agent Execution Model

Every human and AI coding agent starts with:

```text
docs/snapshot-v0.15.3.md
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
docs/implementation/project-directory-structure.md
```

Agents must:

```text
- respect allowed path boundaries;
- start from implementation stubs where available;
- run validation before handoff;
- provide evidence URI mapping;
- stop on authority-boundary ambiguity;
- not invent schema, ID, event, permission, or command semantics.
```

## 9. Validation

Default validation remains strict:

```bash
bash scripts/validate-pack.sh
```

The validator checks active spec uniqueness, YAML duplicate keys, active required docs, project skeleton presence, scoped agent instructions, source stubs, and release-blocking architecture boundaries.

## 10. Phase 0 Definition of Done

Phase 0 is complete only when:

```text
1. Single safe cell edit persists command_log, current-state change, audit_event, domain_event, and outbox_event.
2. Unknown-outcome recovery passes TC-CMD-001.
3. Outbox polling delivers live updates without NOTIFY.
4. NOTIFY benchmark either passes and is admitted, or remains disabled.
5. Security invariant manifest runs in CI.
6. Transactional-batch policy compiler fails closed on hidden dependencies.
7. Hot-path edit rate limiting does not write PostgreSQL counters synchronously.
8. Minimal UI edit path routes grid and any allowed detail/transpose edits through command_api.
9. Agent-authored PRs pass P0-EXEC-001 and include evidence handoff.
10. Repository structure and source stubs remain aligned with `docs/implementation/project-directory-structure.md`.
11. Compliance owner signs readiness or blocks regulated pilot data.
```

## 11. Final v0.15.3 Recommendation

Proceed with Phase 0 implementation using the v0.15.3 repository skeleton and agent work-order catalog. The first sprint should implement repository bootstrap checks, command identity, outbox polling scaffolding, invariant CI, and a minimal command-safe spreadsheet edit path.

Do not optimize for breadth. Optimize for one provably safe mutation with durable recovery and observable replay.
