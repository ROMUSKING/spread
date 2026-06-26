# ADR-0019: TigerBeetle as Target Numeric Ledger Plane

**Version:** 0.13  
**Status:** Accepted target architecture; not an MVP runtime dependency  
**Date:** 2026-06-26  
**Owner:** Engineering Lead + Domain Ledger Owner  
**Related:** `docs/data/numeric-ledger-contract.md`, `docs/dev/numeric-ledger-plane.md`, `docs/gates/P1-LEDGER-001-tigerbeetle-numeric-ledger-spike.md`

## Context

The spreadsheet-native ERP needs strong correctness for conserved numeric movement: financial postings, stock movements, reservations, customer credits, and later other ledger-shaped numeric assets. PostgreSQL remains the MVP control plane and the source of truth for business objects, permissions, workflow state, audit envelopes, and live-update outbox delivery. However, long-term correctness and scale are better served by a dedicated numeric ledger plane.

TigerBeetle is the selected post-MVP target for the numeric ledger plane. The MVP must therefore avoid patterns that would make a later transition expensive or risky.

## Decision

MVP will not require a TigerBeetle cluster on the mutation hot path. MVP will implement a TigerBeetle-shaped numeric ledger abstraction backed by PostgreSQL:

```text
Domain command handler
  -> NumericLedgerPort
  -> PostgresMvpNumericLedgerAdapter in MVP
  -> TigerBeetleNumericLedgerAdapter after P1 evidence
```

All conserved numeric movements in MVP must be represented as append-only debit/credit transfers using deterministic future-compatible account IDs, transfer IDs, ledger codes, transfer codes, fixed-scale unsigned amounts, and command correlation.

After MVP, TigerBeetle becomes the target authoritative engine for ledger-derived numeric balances. PostgreSQL keeps metadata, permissions, workflow, audit envelopes, domain objects, outbox events, and projections.

## Source-of-truth boundary

| Area | MVP authority | Post-MVP target |
|---|---|---|
| Business objects | PostgreSQL | PostgreSQL |
| Permissions and RLS | PostgreSQL/API | PostgreSQL/API |
| Workflow and approvals | PostgreSQL/domain policy | PostgreSQL/domain policy |
| Audit envelope and outbox | PostgreSQL | PostgreSQL |
| Financial/stock transfer facts | PostgreSQL numeric ledger tables | TigerBeetle transfers |
| Ledger-derived balances | PostgreSQL projections derived from transfers | TigerBeetle account state, with PostgreSQL projections |
| Reporting tables | PostgreSQL projections | PostgreSQL projections |

## Mandatory MVP constraints

1. No financial or stock balance may be updated by ad hoc SQL increments outside `NumericLedgerPort`.
2. Every numeric transfer must have deterministic `transfer_id_dec` generated only by the canonical derivation in `docs/data/numeric-ledger-contract.md#canonical-id-and-amount-compatibility-rules`.
3. Every numeric account must have deterministic `account_id_dec` derived from `tenant_id`, `ledger_code`, and canonical account dimensions.
4. Amounts must be stored as unsigned fixed-scale integers in minor units.
5. Ledger and transfer type metadata must use immutable numeric codes plus PostgreSQL metadata tables.
6. The domain layer must keep authorization, workflow, tax, lot/serial, UOM, and approval semantics outside the ledger adapter.
7. MVP must produce reconciliation evidence proving balance projections match append-only transfers.
8. The adapter interface must support single-phase transfers, pending transfers, post-pending, void-pending, lookup by transfer ID, and account creation.

## Consequences

- Financial and stock correctness improves in MVP because numeric movement is append-only and command-correlated.
- Post-MVP TigerBeetle migration can be implemented adapter-first, with shadow reconciliation before cutover.
- MVP implementation is slightly more disciplined than a simple mutable `stock_balance.quantity = quantity - n` model.
- The ERP avoids making TigerBeetle a business-rule engine. Domain policy remains in the command layer.

## Non-goals

- Do not use TigerBeetle for arbitrary numeric fields, prices, rates, forecast values, formula outputs, KPIs, or approval thresholds.
- Do not expose TigerBeetle directly to clients or untrusted services.
- Do not replace PostgreSQL outbox/SSE delivery with TigerBeetle.
- Do not make the MVP dependent on operating a TigerBeetle cluster unless P1-LEDGER-001 is completed and separately accepted.
