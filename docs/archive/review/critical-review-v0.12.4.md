---
version: "0.12.4"
last-reviewed: "2026-06-26"
status: "applied targeted review"
---

# Critical Review and Applied Refinements - v0.12.4

## Review input

The review asked the pack to target TigerBeetle as the post-MVP numeric ledger plane while adapting the MVP to strengthen numeric correctness and make the transition easier.

## Applied refinements

| Finding | v0.12.4 action |
|---|---|
| Post-MVP numeric ledger target was not explicit. | Added ADR-0019 selecting TigerBeetle as the target numeric ledger plane after MVP. |
| MVP risked mutable balance assumptions. | Added append-only numeric ledger contract and `NumericLedgerPort`. |
| Financial and stock movement needed a shared conserved-quantity model. | Added account/transfer mapping for money, stock, credits, quotas, and capacity. |
| Transition could become a rewrite. | Required deterministic future-compatible account and transfer IDs in MVP. |
| Source-of-truth boundaries needed clarity. | PostgreSQL remains control plane; post-MVP TigerBeetle becomes numeric ledger plane for ledger-derived balances. |
| Evidence gate was missing. | Added P1-LEDGER-001, ledger benchmarks, shadow-mode reconciliation, and transition plan. |

## Result

v0.12.4 does not make TigerBeetle an MVP runtime dependency. It makes MVP numeric movement TigerBeetle-ready: append-only, debit/credit based, deterministic-ID driven, adapter-backed, and reconciliable.
