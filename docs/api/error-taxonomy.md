---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "refined baseline"
---

# API Error Taxonomy

## Purpose

Define stable Phase 0 error codes so clients implement idempotency, ambiguity, validation, permission, and rate-limit behavior consistently. Clients branch on `code`, not on message text.

## Problem response envelope

All non-2xx command API responses use `application/problem+json` and include `traceId` and `correlationId` when a command record or request context exists.

```json
{
  "type": "https://docs.example.invalid/problems/command-id-reuse-conflict",
  "title": "Command id reuse conflict",
  "status": 409,
  "code": "COMMAND_ID_REUSE_CONFLICT",
  "detail": "The same commandId was submitted with a different request hash.",
  "traceId": "opaque-trace-id",
  "correlationId": "client-or-server-correlation-id",
  "commandId": "00000000-0000-0000-0000-000000000000"
}
```

## Required codes

| Code | HTTP status | Retry behavior | User-facing behavior | Gate |
|---|---:|---|---|---|
| `COMMAND_ID_REUSE_CONFLICT` | 409 | Do not retry automatically. | Refresh workbook; reconcile manually if needed. | P0-CMD-001 |
| `COMMAND_PENDING` | 202 | Poll the same command ID with backoff. | Keep pending state. | P0-CMD-001 |
| `COMMAND_AMBIGUOUS` | 409 | Do not retry automatically. | Refresh workbook before retrying. | P0-CMD-001 |
| `COMMAND_STATUS_NOT_FOUND` | 404 | Do not create a new command automatically after response loss. | Show unknown outcome and require refresh. | P0-CMD-001 |
| `VALIDATION_FAILED` | 422 | Retry only after user correction. | Mark exact safe row/column errors. | P0-BATCH-001 |
| `TRANSACTIONAL_BATCH_POLICY_MISSING` | 409 | Retry only in `atomic` mode if domain permits. | Explain partial commit is unavailable. | P0-BATCH-001 |
| `PARTITION_VALIDATION_TIMEOUT` | 409 | Do not retry as partial batch automatically. | Fail affected partition closed. | P0-BATCH-001 |
| `RATE_LIMITED` | 429 | Honor `Retry-After`. | Show temporary throttle. | P0-RATE-001 |
| `FORMULA_GRAPH_STALE` | 409 | Wait for rebuild or refresh. | Display stale-safe formula state. | P1-FORM-001 |
| `PERMISSION_DENIED` | 403 | Do not retry without permission change. | Do not reveal hidden object or field names. | P0-INV-001 |
| `UNAUTHORIZED_REFERENCE` | 403 | Do not retry. | Hide forbidden source details. | P0-INV-001 |

## Required tests

```text
ci://tests/api/error-taxonomy-stability
ci://tests/api/problem-json-shape
ci://tests/client/no-auto-retry-after-ambiguous-command
ci://tests/security/validation-errors-do-not-leak-forbidden-fields
```
