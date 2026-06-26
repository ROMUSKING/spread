# ADR-0016: Phase 0 Execution Order

**Version:** 0.13  
**Last-reviewed:** 2026-06-26  
**Status:** Required for Phase 0

## Decision

Phase 0 implementation proceeds in this locked order:

1. Command log and unknown-outcome recovery.
2. Durable outbox polling and SSE delivery.
3. Security invariant CI harness.
4. Transactional-batch partition compiler.
5. Hot-path rate limiting.

Formula worker, compliance, grid dependency, and Rust/WASM work may run as spikes, but they cannot bypass the P0 gate order.

## Mandatory vertical slice

Before broad editable-cell work, a single safe cell edit must complete:

```text
command -> command_log -> current table -> audit_events -> domain_events -> outbox_events -> polling SSE -> command-status recovery
```

## Rationale

This order proves safe mutation, replayability, observability, and security before user-facing spreadsheet breadth.

## Acceptance

- P0-CMD-001 and P0-LIVE-001 are signed.
- Vertical slice includes lost-response recovery.
- `trace_id` and `correlation_id` exist across command, audit, domain, outbox, and SSE records.
