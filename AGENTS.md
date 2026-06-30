# AI Coding Agent Instructions — Spreadsheet-Native ERP v0.18.0

**Version:** 0.18.0  
**Status:** Active repository-smoke implementation baseline  
**First read:** `docs/snapshot-v0.18.0.md`

## Mandatory first step

Before implementation, confirm you have read `docs/snapshot-v0.18.0.md`. The “What agents may NOT do today” checklist is a stop-condition list, not guidance.

## Non-negotiable boundaries

```text
- All mutations go through command_api and command handlers.
- Durable outbox polling remains the default live-update path.
- No TigerBeetle, pgvector, DuckDB, broker/CDC, external connector runtime, or full tiled workspace runtime in Phase 0 edit path.
- Do not create or alter DDL outside canonical data-contract files.
- Do not bypass RetrievalRevalidator for derived-plane results.
- Run validation and smoke typecheck before handoff.
```

## Required commands before handoff

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
bash scripts/smoke-package-tests.sh
```

## Canonical files

| Purpose | Path |
|---|---|
| Architecture snapshot | `docs/snapshot-v0.18.0.md` |
| Phase 0 work orders | `docs/implementation/phase0-agent-work-orders.md` |
| UI/UX specification | `docs/ui/spreadsheet-native-ux-specification.md` |
| Project structure | `docs/implementation/project-directory-structure.md` |
| Stub index | `docs/implementation/code-stub-index.md` |
| Command handler skeleton | `apps/api/src/commands/CommandHandlerBase.ts` |
| Active spec | `spec/spreadsheet_native_erp_technical_spec_v0_18_0_research_driven_phase0_ui_ux_audit_complete_execution.md` |
| Validation waiver policy | `docs/process/validation-waiver-policy.md` |

## Validation waiver mode

Only non-release-blocking documentation/process warnings may use:

```bash
bash scripts/validate-pack.sh --waiver DOC-WAIVER-YYYYMMDD-XXX
```

The waiver ID must already exist in `docs/process/decision-waiver-log.md`. Release-blocking failures are never waivable.