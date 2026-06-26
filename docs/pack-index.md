# Spreadsheet-Native ERP v0.16.1 Pack Index

version: "0.16.1"  
last-reviewed: "2026-06-26"  
status: "Phase 0 runnable project bootstrap baseline with source stubs, smoke typecheck, and scoped agent instructions"

## START HERE — Architecture Snapshot

The first read for every human contributor and AI coding agent is:

```text
docs/snapshot-v0.16.1.md
```

The snapshot contains the authority map, repository tree, locked P0 order, agent non-goals, post-MVP exclusions, required smoke commands, and merge rule. Do not start from the main spec unless you already understand the snapshot.

## Bootstrap achieved

P0-EXEC-001 is green for the runnable bootstrap baseline. Attached evidence lives in `docs/qa/bootstrap-completion-evidence-v0.16.1.md`. Begin real implementation with `AGENT-000 -> AGENT-001 -> AGENT-010 -> AGENT-011 -> AGENT-012`.

## 15-minute reading path

| Reader | Read first | Then read |
|---|---|---|
| Any contributor | `docs/snapshot-v0.16.1.md` | `README.md` |
| AI coding agent | `AGENTS.md` | `docs/implementation/phase0-agent-work-orders.md` |
| Backend/API | `docs/dev/command-lifecycle.md` | `apps/api/src/commands/CommandHandlerBase.ts` |
| SRE/platform | `docs/dev/outbox-polling-reader.md` | `apps/api/src/outbox/OutboxPoller.ts` |
| Security | `invariants/security-invariants.yml` | `docs/security/threat-model-summary.md` |
| Frontend | `docs/dev/client-optimistic-ui-and-conflicts.md` | `apps/web/src/components/GridShell.tsx` |
| QA | `tests/manifest.yml` | `docs/qa/agent-implementation-validation-plan.md` |
| Product/domain | `docs/plan/vertical-slice-acceptance-checklist.md` | `docs/risk-register.md` |

## Active baseline

The active normative specification is:

```text
spec/spreadsheet_native_erp_technical_spec_v0_16_1_research_driven_phase0_bootstrap_complete_execution.md
```

The active project-structure contract is:

```text
docs/implementation/project-directory-structure.md
```

The active source stub index is:

```text
docs/implementation/code-stub-index.md
```

## v0.16.1 Runnable Bootstrap Summary

v0.16.1 adds a runnable smoke-test layer without widening MVP runtime scope:

```text
- root TypeScript/pnpm workspace files;
- apps/api and apps/web stubs;
- packages/domain, db, contracts, config, observability, testkit, and ui stubs;
- scoped AGENTS.md files and AI tool instruction pointers;
- .gitignore for Node/TypeScript/PostgreSQL/local analytics artifacts;
- scripts/smoke-typecheck.sh and tsconfig.smoke.json;
- generated dist, generated .d.ts, and tsbuildinfo files excluded from source archive;
- historical docs under docs/archive/.
```

## Locked Phase 0 order

```text
P0-EXEC-001 -> P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001 -> vertical slice acceptance
```

`P0-EXEC-001` is process/readiness only. It does not reorder the product gates.
