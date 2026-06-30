# Spreadsheet-Native ERP v0.18.0 Pack Index

version: "0.18.0"  
last-reviewed: "2026-06-30"  
status: "Phase 0 UI/UX audit closure with command-synergistic improvement roadmap"

## START HERE — Architecture Snapshot

The first read for every human contributor and AI coding agent is:

```text
docs/snapshot-v0.18.0.md
```

The snapshot contains the authority map, repository tree, locked P0 order, agent non-goals, post-MVP exclusions, required smoke commands, and merge rule. Do not start from the main spec unless you already understand the snapshot.

## Bootstrap achieved

P0-EXEC-001 is green for the runnable bootstrap baseline. Attached evidence lives in `docs/qa/bootstrap-completion-evidence-v0.17.0.md`. Begin real implementation with `AGENT-000 -> AGENT-001 -> AGENT-010 -> AGENT-011 -> AGENT-012`, then UI synergy work orders AGENT-061..065 after AGENT-060 vertical slice green.

## 15-minute reading path

| Reader | Read first | Then read |
|---|---|---|
| Any contributor | `docs/snapshot-v0.18.0.md` | `README.md` |
| AI coding agent | `AGENTS.md` | `docs/implementation/phase0-agent-work-orders.md` |
| Backend/API | `docs/dev/command-lifecycle.md` | `apps/api/src/commands/CommandHandlerBase.ts` |
| SRE/platform | `docs/dev/outbox-polling-reader.md` | `apps/api/src/outbox/OutboxPoller.ts` |
| Security | `invariants/security-invariants.yml` | `docs/security/threat-model-summary.md` |
| Frontend | `docs/dev/client-optimistic-ui-and-conflicts.md` | `docs/ui/spreadsheet-native-ux-specification.md` |
| QA | `tests/manifest.yml` | `docs/qa/agent-implementation-validation-plan.md` |
| Product/domain | `docs/plan/vertical-slice-acceptance-checklist.md` | `docs/review/ui_ux_alternative_development_paths.md` |

## Active baseline

The active normative specification is:

```text
spec/spreadsheet_native_erp_technical_spec_v0_18_0_research_driven_phase0_ui_ux_audit_complete_execution.md
```

The active project-structure contract is:

```text
docs/implementation/project-directory-structure.md
```

The active source stub index is:

```text
docs/implementation/code-stub-index.md
```

## v0.18.0 UI/UX Audit Summary

v0.18.0 closes the UI/UX audit without widening MVP runtime scope:

```text
- spec §11 audit closure and AGENT-061..065 work orders;
- hybrid grid strategy (react-window + Glide POC per ADR-0028);
- column metadata, action columns, cross-workbook refresh, grouped flattened views;
- preview tiling clarified as scaffolding until P1-UX-001;
- v0.17.0 bootstrap evidence and QA docs remain valid.
```

## Locked Phase 0 order

```text
P0-EXEC-001 -> P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001 -> vertical slice acceptance
```

`P0-EXEC-001` is process/readiness only. It does not reorder the product gates.