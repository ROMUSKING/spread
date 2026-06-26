# ADR-0017: Command Log Privacy and Trace Context

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required for Phase 0

## Context

`command_log` is required for idempotency and unknown-outcome recovery, but it is close to sensitive data: request bodies, response bodies, IP addresses, user identifiers, audit events, and tracing metadata. The v0.12.1 refinement added trace and replay fields, but it still risked treating tracing IDs as UUID-only and keeping response bodies longer than necessary.

## Decision

- Store `trace_id` as `TEXT`, not UUID. It should accept W3C Trace Context / OpenTelemetry identifiers. A UUID string is allowed only as a local fallback.
- Store `correlation_id` as the client-facing operational identifier.
- Store `request_hash` for canonical idempotency comparison.
- Store `request_body_hash` for raw-byte equality/debug evidence. Do not store raw request bodies by default.
- Store `response_body_redacted` only when the redacted outcome is safe to retain for the command TTL.
- Use encrypted short-retention `response_ref` where exact replay requires sensitive response material.
- Treat `client_ip` as personal-data-adjacent telemetry and govern it through the compliance retention matrix.

## Consequences

- Command recovery remains durable without turning `command_log` into a payload archive.
- Trace propagation can integrate with real OpenTelemetry deployments.
- Compliance has a concrete boundary for command recovery data.

## Acceptance

- `PRIV-001` and `OBS-001` invariants pass.
- `P0-CMD-001` proves replay from redacted outcome or encrypted response reference.
- `docs/security/command-log-privacy.md` is reviewed by Security and Compliance owners.
