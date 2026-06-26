---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "refined baseline"
---

# Command Status API Contract

## Purpose

Define the recovery API used after a lost command response and by duplicate in-flight command submissions.

## Normative behavior

- The endpoint is scoped by tenant and caller permissions.
- It returns terminal outcomes for matching `commandId` + `request_hash` where available.
- It returns `COMMAND_PENDING` for an in-flight duplicate with matching hash.
- It never exposes a command belonging to another tenant or user scope.
- It returns only redacted response data or an authorized encrypted response reference.

## OpenAPI-style stub

The machine-readable stub is `docs/api/command-status.openapi.yml`.

Required response fields:

```yaml
commandId: string uuid
status: received | committed | rejected | failed | ambiguous
traceId: string   # OpenTelemetry trace ID or local fallback
correlationId: string
responseBodyRedacted: object | null
responseRef: string | null
errorCode: string | null
```

## Error taxonomy

| Error code | HTTP status | Meaning | Retry behavior |
|---|---:|---|---|
| `COMMAND_ID_REUSE_CONFLICT` | 409 | Same command ID was used with a different request hash. | Do not retry automatically. |
| `COMMAND_AMBIGUOUS` | 409 | Outcome cannot be proven after retention/reconciliation. | Refresh workbook; user confirmation required. |
| `COMMAND_PENDING` | 202 | Command received but still unresolved. | Poll same command ID after `Retry-After`. |
| `RATE_LIMITED` | 429 | Request exceeded applicable budget. | Honor `Retry-After`. |
| `VALIDATION_FAILED` | 422 | Business validation rejected the command. | User correction required. |
| `PERMISSION_DENIED` | 403 | Caller lacks permission for the projected cell/source object. | Do not retry without permission change. |

## Required tests

- `ci://tests/api/command-status-contract`
- `ci://tests/api/command-duplicate-inflight-pending`
- `ci://tests/api/command-id-reuse-conflict`
- `ci://tests/api/command-response-redaction-or-encrypted-ref`
