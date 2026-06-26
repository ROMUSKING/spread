---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
---

# Client Optimistic UI and Conflict Handling

## Purpose

Define minimal client behavior for the Phase 0 vertical slice. This is intentionally narrow and does not authorize broad collaboration UX.

## Normative behavior

- The client may show a local pending edit after `POST /api/v1/commands` is sent.
- Pending state must be visually distinct from committed state.
- The client must reconcile from command status and SSE, not from local optimism alone.
- After ambiguity, the client must require workbook refresh before retrying.
- The client must not apply SSE deltas before the subscription initial snapshot is complete.

## State model

```text
idle
  -> locally_pending
  -> command_pending
  -> committed
  -> rejected
  -> ambiguous_requires_refresh
  -> conflict_requires_reload
```

## Conflict cases

| Case | Client behavior |
|---|---|
| Same cell changed remotely before local commit | Show conflict and refresh row/workbook segment. |
| Command returns validation error | Revert pending value and show cell-level error. |
| Command remains pending beyond UX timeout | Keep pending indicator; allow status refresh; do not send new commandId. |
| Command is ambiguous/not found after timeout | Block retry until workbook refresh. |
| SSE retention gap | Discard local projection and full refresh. |

## Required tests

- `ci://tests/client/optimistic-pending-state`
- `ci://tests/client/ambiguous-requires-refresh`
- `ci://tests/client/sse-before-snapshot-blocked`
- `ci://tests/client/conflict-requires-reload`

## Links

- `docs/api/error-taxonomy.md`
- `docs/api/command-status-openapi.md`
- `docs/gates/P0-CMD-001-command-identity-and-unknown-outcome.md`
- `docs/gates/P0-LIVE-001-polling-first-outbox-live-updates.md`

## User-facing ambiguity patterns

Ambiguous command outcomes must be explicit but not alarming. Use stable wording and preserve the command ID in the details panel.

### Lost response after submit

Primary message:

```text
This edit may have been saved, but the connection ended before confirmation. Refresh this row before retrying.
```

Actions:

```text
Refresh row
Refresh workbook
Copy command ID
```

Disallowed action:

```text
Retry as new edit
```

### Retry with confirmation after refresh

A retry is allowed only after the client has refreshed from server state and the user confirms the desired value is still not present.

```text
1. Refresh affected row/workbook segment.
2. Compare server value to intended value.
3. If server value already equals intended value, mark resolved.
4. If server value differs, show diff and ask for explicit confirmation.
5. Submit a new command ID only after confirmation.
```

### Pending indicators

Every locally pending cell must show:

- visual pending state distinct from committed value
- command type
- elapsed pending time
- copyable `command_id` in diagnostics/details
- disabled conflicting edit controls while command is unresolved

### Offline queue guidance

Offline queuing is not a Phase 0 default. If an offline queue is later admitted:

- each queued mutation has a pre-generated command ID
- queue order is visible to the user
- queued commands stop on first ambiguity or conflict
- server refresh is required before resuming after ambiguity
- queued commands must still pass rate limits and policy checks at send time

### Optimistic batch mode

Optimistic batch UX is prohibited until `transactional_batch` partition policy evidence exists. A future optimistic batch mode must show partition-level pending and failure states, not one false all-or-nothing banner unless the domain uses `atomic` mode.

## Additional required tests

- `ci://tests/client/ambiguous-retry-after-refresh-confirmation`
- `ci://tests/client/pending-indicator-command-id-visible`
- `ci://tests/client/offline-queue-stops-on-ambiguity`
- `ci://tests/client/optimistic-batch-disabled-before-partition-policy`
