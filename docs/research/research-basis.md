# Research Basis for v0.13

**Last-reviewed:** 2026-06-26

This document records research inputs used to maintain the Phase 0 pack.

## Primary references

- PostgreSQL `NOTIFY` and `LISTEN` documentation, including commit-time delivery and notification queue behavior.
- PostgreSQL row-level security documentation.
- PostgreSQL unlogged table behavior for transient non-authoritative data.
- Node.js `worker_threads`, transferables, and worker lifecycle documentation.
- Browser EventSource/SSE documentation.
- Browser SharedArrayBuffer security constraints.
- IETF HTTPAPI RateLimit header fields draft, currently tracked as work in progress.
- RFC 6585 for `429 Too Many Requests`.
- Operational incident reports on `LISTEN/NOTIFY` scalability risks.
- TigerBeetle data modeling, account, transfer, requests, Node.js client, and two-phase transfer documentation.

## Pack policy derived from research

- Polling-first outbox delivery is the default.
- `NOTIFY` is a wake-up optimization only, admitted by benchmark.
- PostgreSQL counters do not run on the ordinary edit hot path.
- Formula worker optimization starts with TypeScript resident graph and delta messages.
- Rust/WASM remains evidence-gated.
- Security invariants and compliance gates are executable requirements, not prose-only guidance.

## TigerBeetle-derived numeric ledger policy

- TigerBeetle is the post-MVP target numeric ledger plane, not an MVP runtime dependency.
- MVP must model conserved numeric movement as append-only account/transfer facts.
- PostgreSQL remains the control plane, audit/outbox authority, and projection/reporting store.
- Domain authorization, workflow, tax, lot/serial, UOM, and compliance rules stay outside the numeric ledger adapter.
