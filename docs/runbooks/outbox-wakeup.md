---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "compatibility pointer"
---

# Legacy Pointer: Outbox Wake-Up Runbook

Canonical path: `docs/ops/outbox-wakeup-runbook.md`.

This file is retained for compatibility with v0.12/v0.12.1 links recovered during the archive comparison. New references must use the canonical ops path.


## v0.13.2 post-MVP fan-out note

MVP behavior remains polling-first. Post-MVP fan-out, CDC, broker, and external event-bus adoption is governed by `docs/data/outbox-integration-strategy-options.md`, `docs/data/event-envelope-contract.md`, and `P1-OUTBOX-001`. Do not publish directly to a broker from command handlers.
