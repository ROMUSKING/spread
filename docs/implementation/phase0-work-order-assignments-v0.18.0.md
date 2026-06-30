# Phase 0 Work-Order Assignments v0.18.0

**Version:** 0.18.0  
**Status:** Implementation assignment path after UI/UX audit closure

## Assignment order

| Order | Work order | Primary goal | Must pass before handoff |
|---:|---|---|---|
| 1 | AGENT-000 | Confirm bootstrap, workspace scripts, validation, and evidence wiring. | `validate-pack`, smoke typecheck, package smoke tests. |
| 2 | AGENT-001 | Test harness and evidence URI mapping. | manifest/evidence mapping tests. |
| 3 | AGENT-010 | Command log schema and migration. | command-log schema tests and AUD-001 compatibility. |
| 4 | AGENT-011 | Command status API. | command-status TTL/reuse/pending tests. |
| 5 | AGENT-012 | Command transaction boundary + MVP NumericLedgerPort. | atomic current/audit/domain/outbox and ledger-port-in-PG-transaction tests. |
| 6 | AGENT-013 | Client unknown-outcome and optimistic edit UX. | optimistic-ui and ambiguous-requires-refresh tests. |
| 7 | AGENT-060 | Vertical slice UI — one safe cell e2e green. | `ci://tests/e2e/vertical-slice/safe-cell-edit` |
| 8 | AGENT-061 | Column metadata rendering. | `ci://tests/ui/column-meta-renders-enum-select` |
| 9 | AGENT-062 | Cross-workbook live refresh. | `ci://tests/ui/cross-workbook-tile-refresh` |
| 10 | AGENT-063 | Flattened order client grouping. | `ci://tests/ui/sales-order-group-rendering` |
| 11 | AGENT-064 | Grid scalability + Glide POC. | `ci://benchmarks/BENCH-UX-001`, Glide POC wiring test |
| 12 | AGENT-065 | Extract packages/ui + refactor page.tsx hooks. | `ci://tests/ui/command-status-visible-in-tiles` |

## Guardrails

```text
- One work order per PR unless explicitly approved by Engineering Lead.
- Preview tiling is scaffolding; P1-UX-001 evidence required before production tiling.
- No post-MVP runtime dependency may be added by these work orders.
- Validation, smoke typecheck, and package smoke tests must be attached to handoff.
```