# Gate: P0-CMD-001 - Command Identity and Unknown-Outcome Recovery

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Owner:** API/Client Owner  
**Priority:** P0  
**Waiver allowed:** No  
**Normative spec:** v0.17.0 sections 6 and 12.1  
**SLO reference:** `docs/slo-baseline.yml`

## Requirement

Every mutation command must be idempotent, traceable, and queryable after a lost response.

## Required behavior

- Implement `command_log` before editable cell endpoints.
- `tenant_id + command_id` is a durable idempotency key.
- Same command ID plus same `request_hash` returns the original outcome.
- Same command ID plus different `request_hash` returns `COMMAND_ID_REUSE_CONFLICT`.
- Persist `trace_id`, `correlation_id`, `request_body_hash`, `response_body_redacted` or encrypted `response_ref`, `response_body_redacted_hash`, and `client_ip` where available.
- Command status is queryable for at least 24 hours; pilot target is 7 days.
- Client never auto-retries with a new command ID after ambiguous outcome.
- `ambiguous` is set only by TTL cleanup when expiry passed and no audit/domain/outbox correlation exists.
- Client optimistic pending, conflict, ambiguous, and sync-required states follow `docs/dev/client-optimistic-ui-and-conflicts.md`.

## Evidence required

- `ci://tests/e2e/TC-CMD-001-network-loss-after-commit`
- `ci://tests/api/command-status-ttl`
- `ci://tests/api/command-id-reuse-conflict`
- `ci://tests/sql/aud-001-command-audit-domain-outbox-correlation`
- `repo://docs/api/command-status.openapi.yml`
- `repo://docs/ops/unknown-command-outcome-runbook.md`
- `repo://docs/dev/client-optimistic-ui-and-conflicts.md`

## Failure behavior

Block Phase 0 release if duplicate mutation is possible after response loss or if command correlation cannot be proven.


## Implementation-readiness evidence

- `ci://tests/api/command-transaction-boundary-savepoints`
- `ci://tests/api/command-ledger-port-in-same-pg-transaction`
- `ci://benchmarks/BENCH-CMD-TX-001`


## v0.17.0 active baseline note

This P0 gate is active under the v0.17.0 AI coding-agent implementation-roadmap baseline.
