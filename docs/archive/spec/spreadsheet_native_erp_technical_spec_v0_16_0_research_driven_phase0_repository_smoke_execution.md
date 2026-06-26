# Spreadsheet-Native ERP Technical Specification v0.16.0

**Date:** 2026-06-26  
**Status:** Phase 0 repository-smoke and implementation-bootstrap baseline  
**Supersedes:** v0.15.3 project-structure bootstrap baseline  
**Version note:** This is **v0.16.0**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, AI coding agents, reviewers, QA, SRE, security, compliance, product, and domain owners.

## 1. Executive Summary

v0.16.0 promotes the project from a repository-structure bootstrap to a runnable repository-smoke baseline. It keeps the same product scope as v0.15.3, but adds a smoke-test script, CI wiring, visible repository-smoke SLOs, and a stronger first-read snapshot with a repository-shape diagram.

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

## 2. v0.16.0 Repository Smoke Additions

| Area | v0.15.3 state | v0.16.0 refinement |
|---|---|---|
| Repository structure | Actual `apps/` and `packages/` skeleton. | Structure retained and validated as a runnable TypeScript workspace. |
| Smoke testing | Structure validation only. | Added `scripts/repo-smoke.sh` and `package.json` `repo:smoke` script. |
| Type checking | Package-local scripts existed. | Repository smoke runs `tsc -p tsconfig.json --noEmit --pretty false`. |
| Snapshot | First-read architecture snapshot. | Added folder-tree Mermaid diagram and explicit first commands. |
| Skeleton placement | Source stubs moved into `apps/` and `packages/`. | Validation confirms no TypeScript skeletons remain under `docs/skeletons/`. |
| Version cleanup | v0.15.3 active baseline. | Active spec, snapshot, changelog, manifest, SLOs, invariants, package version, and validation target v0.16.0. |

## 3. Repository Shape

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

## 4. Smoke-Test Contract

The repository smoke test is:

```bash
bash scripts/repo-smoke.sh
```

It must remain fast and deterministic. It checks:

```text
1. root package metadata is readable and private;
2. TypeScript compiler is available from node_modules or PATH;
3. tsc -p tsconfig.json --noEmit --pretty false passes;
4. core implementation stubs exist in apps/ and packages/;
5. no duplicate TypeScript skeletons exist under docs/skeletons/.
```

The smoke test does not replace `scripts/validate-pack.sh`; it proves the repository skeleton can be typechecked.

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
docs/snapshot-v0.16.0.md
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
docs/implementation/project-directory-structure.md
```

Agents must:

```text
- respect allowed path boundaries;
- start from implementation stubs where available;
- run validation and repository smoke before handoff;
- provide evidence URI mapping;
- stop on authority-boundary ambiguity;
- not invent schema, ID, event, permission, or command semantics.
```

## 9. Validation

Default validation remains strict:

```bash
bash scripts/validate-pack.sh
```

Repository smoke is also required:

```bash
bash scripts/repo-smoke.sh
```

The validator checks active spec uniqueness, YAML duplicate keys, active required docs, project skeleton presence, scoped agent instructions, source stubs, smoke script presence, smoke execution, and release-blocking architecture boundaries.

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
10. Repository structure, source stubs, and repository smoke remain green.
11. Compliance owner signs readiness or blocks regulated pilot data.
```

## 11. Final v0.16.0 Recommendation

Proceed with Phase 0 implementation using the v0.16.0 repository smoke baseline and agent work-order catalog. The first sprint should implement repository bootstrap checks, command identity, outbox polling scaffolding, invariant CI, and a minimal command-safe spreadsheet edit path.

Do not optimize for breadth. Optimize for one provably safe mutation with durable recovery, observable replay, and a repository skeleton that typechecks.
