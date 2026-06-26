# CHANGELOG v0.13.3

**Date:** 2026-06-26  
**Status:** implementation-readiness review closure

## Added

- Normative command transaction boundary sequence and pseudo-code in `docs/dev/command-lifecycle.md`.
- RetrievalRevalidator middleware/service sketch, cache rules, and performance budgets.
- Concrete OpenTelemetry examples and `docs/observability/otel-reference.yml`.
- TigerBeetle shadow-mode day-in-the-life operational note.
- Recovery playbooks for outbox bloat, stalled outbox delivery, and strict-shadow ledger mismatch.
- Implementation-readiness diagrams.

## Updated

- Manifest, invariants, SLOs, validation, README, pack index, and normative source map.

## New invariants

- `CMD-004` command transaction boundary.
- `AI-010` RetrievalRevalidator cache cannot expand visibility.
- `OBS-002` required OTel spans/metrics.
- `LEDGER-009` shadow mode cannot block MVP edit path without gate admission.
