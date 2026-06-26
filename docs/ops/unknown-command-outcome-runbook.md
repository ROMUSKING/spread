# Runbook: Unknown Command Outcome

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Trigger

Client submitted a command but lost the HTTP response, timed out, or received an indeterminate transport error.

## Client procedure

1. Poll `GET /api/v1/commands/{commandId}`.
2. Render returned outcome if status is `committed`, `rejected`, or `failed`.
3. If status remains `received` beyond timeout, keep pending state and offer refresh.
4. If command is `ambiguous`, expired, or not found, show: `This edit may have succeeded. Refresh the workbook before retrying.`
5. Never auto-retry with a new command ID.

## Operator procedure

1. Look up command by tenant ID and command ID.
2. Verify command log, audit event, domain event, and outbox correlation.
3. Use `trace_id` and `correlation_id` to follow the request through API, database, outbox, and SSE logs.
4. If committed but delivery is missing, replay outbox from high watermark.
5. If AUD-001 fails, quarantine the tenant workbook and open a correctness incident.

## Ambiguity rule

`ambiguous` is set only by TTL cleanup when `expires_at` passed and no correlated audit/domain/outbox record exists for the command ID.
