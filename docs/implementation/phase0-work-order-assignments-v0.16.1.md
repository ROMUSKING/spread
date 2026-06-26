# Phase 0 Work-Order Assignments v0.16.1

**Version:** 0.16.1  
**Status:** First implementation assignment path after bootstrap completion

## Assignment order

| Order | Work order | Primary goal | Must pass before handoff |
|---:|---|---|---|
| 1 | AGENT-000 | Confirm bootstrap, workspace scripts, validation, and evidence wiring. | `validate-pack`, smoke typecheck, package smoke tests. |
| 2 | AGENT-001 | Test harness and evidence URI mapping. | manifest/evidence mapping tests. |
| 3 | AGENT-010 | Command log schema and migration. | command-log schema tests and AUD-001 compatibility. |
| 4 | AGENT-011 | Command status API. | command-status TTL/reuse/pending tests. |
| 5 | AGENT-012 | Command transaction boundary + MVP NumericLedgerPort. | atomic current/audit/domain/outbox and ledger-port-in-PG-transaction tests. |

## Guardrails

```text
- One work order per PR unless explicitly approved by Engineering Lead.
- No outbox/live-update implementation before AGENT-010/011/012 are reviewable.
- No post-MVP runtime dependency may be added by these work orders.
- Validation, smoke typecheck, and package smoke tests must be attached to handoff.
```
