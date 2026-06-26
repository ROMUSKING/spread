# Spreadsheet-Native ERP v0.16.1 Runnable Project Bootstrap Pack

**Version:** 0.16.1  
**Last-reviewed:** 2026-06-26  
**Status:** Phase 0 runnable implementation baseline with AI coding-agent roadmap, project structure, source stubs, smoke typecheck, and scoped agent instructions

## START HERE — Architecture Snapshot

Read this first:

```text
docs/snapshot-v0.16.1.md
```

Do not start implementation before reading the snapshot. It contains the authority map, repository tree, locked Phase 0 order, immediate non-goals, required smoke commands, and things agents may not do today.

```text
First product target: one safe spreadsheet edit through command_api, PostgreSQL transaction, durable outbox polling, and command-status recovery.
```

## Bootstrap achieved

P0-EXEC-001 is green for the runnable bootstrap baseline. Evidence is attached in `docs/qa/bootstrap-completion-evidence-v0.16.1.md`. The first implementation path is `AGENT-000 -> AGENT-001 -> AGENT-010 -> AGENT-011 -> AGENT-012`.

## New in v0.16.1

v0.16.1 promotes the project skeleton into a runnable smoke-tested bootstrap:

```text
apps/api       command API, outbox polling, SSE, and integration staging stubs
apps/web       minimal spreadsheet UI shell
packages/domain domain model, commands, and NumericLedgerPort stubs
packages/*     db, contracts, config, observability, testkit, and UI package stubs
scripts/       pack validation and smoke typecheck
```

It adds:

```text
scripts/smoke-typecheck.sh
tsconfig.smoke.json
docs/qa/repository-smoke-test-v0.16.1.md
v0.16.1 snapshot repository tree visual
```

## Minimal Phase 0 scope

The first implementation target remains one safe cell edit:

```text
command identity -> current/audit/domain/outbox commit -> polling SSE -> command-status recovery
```

Do not introduce TigerBeetle, pgvector, DuckDB, CDC, broker fan-out, iPaaS connectors, webhooks, EDI, full tiled UI, or external connector runtime into the ordinary edit path during Phase 0.

## Canonical files

| Area | Path |
|---|---|
| Architecture snapshot | `docs/snapshot-v0.16.1.md` |
| Agent instructions | `AGENTS.md` |
| Project directory contract | `docs/implementation/project-directory-structure.md` |
| Stub index | `docs/implementation/code-stub-index.md` |
| Smoke typecheck | `scripts/smoke-typecheck.sh` |
| Normative specification | `spec/spreadsheet_native_erp_technical_spec_v0_16_1_research_driven_phase0_bootstrap_complete_execution.md` |
| Pack index | `docs/pack-index.md` |
| Agent roadmap | `docs/implementation/ai-coding-agent-roadmap.md` |
| Phase 0 work orders | `docs/implementation/phase0-agent-work-orders.md` |
| Tech-stack snapshot | `docs/tech-stack-decisions.md` |
| Active changelog | `docs/changelog/CHANGELOG-v0.16.1.md` |
| Invariants | `invariants/security-invariants.yml` |
| Test manifest | `tests/manifest.yml` |
| SLO baseline | `docs/slo-baseline.yml` |

## Locked product gate order

```text
P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001
```

`P0-EXEC-001` is an execution-governance gate for agent-authored PRs. It does not reorder the product gates.

## Required validation

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
bash scripts/smoke-package-tests.sh
```

Pack validation and smoke typecheck must pass before merge. Agent PRs must also run implementation tests relevant to their work order.
