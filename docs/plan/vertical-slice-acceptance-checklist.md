---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
---

# Vertical Slice Acceptance Checklist

## Scope

The vertical slice proves one safe editable inventory cell end to end using the pilot dataset.

## Dataset

Use `docs/data/pilot-dataset-definition.md` and dataset key `pilot-v1-small` unless a gate explicitly requires `pilot-v1-10k`.

## Acceptance checklist

| ID | Check | Evidence URI | Owner | Required |
|---|---|---|---|---|
| VS-001 | Client can submit one safe cell edit with `commandId`, `request_hash`, `traceparent`, and `correlation_id`. | `ci://tests/e2e/vertical-slice/safe-cell-edit-submit` | API/Client | Yes |
| VS-002 | Duplicate in-flight same command returns `202 COMMAND_PENDING` and executes no second mutation. | `ci://tests/api/command-pending-duplicate` | API/Client | Yes |
| VS-003 | Commit writes current table, `audit_events`, `domain_events`, and `outbox_events` in one transaction. | `ci://tests/e2e/vertical-slice/transactional-write-set` | Backend | Yes |
| VS-004 | Lost HTTP response recovers via `GET /api/v1/commands/{commandId}`. | `ci://tests/e2e/TC-CMD-001-network-loss-after-commit` | API/Client | Yes |
| VS-005 | SSE subscription performs initial snapshot before applying replayed deltas. | `ci://tests/live-update/sse-initial-snapshot-replay` | Platform/SRE | Yes |
| VS-006 | Polling reader delivers by high watermark and handles non-gapless `outbox_id`. | `ci://tests/live-update/outbox-polling-replay` | Platform/SRE | Yes |
| VS-007 | Full refresh is triggered when replay retention gap is detected. | `ci://tests/live-update/full-refresh-fallback` | Platform/SRE | Yes |
| VS-008 | Command log stores no raw request body and no unredacted response body. | `ci://tests/security/command-log-privacy` | Security | Yes |
| VS-009 | Required spans/metrics contain `trace_id`, `correlation_id`, `tenant_id`, and `command_id`. | `ci://tests/observability/trace-propagation` | SRE | Yes |
| VS-010 | End-to-end p95 stays within `BENCH-CMD-001` and `BENCH-LIVE-001` targets. | `ci://benchmarks/vertical-slice/pilot-v1-small` | QA/SRE | Yes |

## Exit rule

All required checks must pass or be recorded in `docs/process/decision-waiver-log.md` with explicit owner sign-off. P0-CMD-001 and P0-LIVE-001 may not be waived for the vertical slice.

## v0.16.1 accessibility and mobile minimum

The vertical slice does not require the full tiled workspace, but the minimal spreadsheet edit path must not block later accessible/mobile UI work.

Acceptance checks:

```text
ci://tests/ui/grid-keyboard-navigation-basic
ci://tests/ui/grid-screen-reader-labels-basic
ci://tests/ui/touch-edit-does-not-bypass-command-api
ci://tests/ui/no-tile-transpose-mutation-before-p1-ux
```

Minimum behavior:

```text
- keyboard focus can enter, edit, commit, and leave the editable cell;
- pending/failed/ambiguous command status is visible without relying only on color;
- touch edit uses the same command path as keyboard edit;
- any MVP transposed/detail field maps to a canonical field ID and command API call.
```
