# Phase 0 PR Checklist

**Version:** 0.13.2

Use this checklist for any PR touching command execution, live updates, permissions, batching, formulas, rate limiting, numeric ledger movement, TigerBeetle migration artifacts, or compliance-relevant data flows.

## Required before merge

- [ ] Relevant gate card updated or explicitly marked unaffected.
- [ ] `docs/slo-baseline.yml` target referenced by benchmark or test.
- [ ] `tests/manifest.yml` updated for any new CI evidence.
- [ ] `invariants/security-invariants.yml` updated for any new release-blocking invariant.
- [ ] Command path carries `trace_id` and `correlation_id`.
- [ ] No ordinary edit endpoint writes PostgreSQL rate-limit counters synchronously.
- [ ] Outbox writes remain durable and replayable by high watermark.
- [ ] Unknown command outcome UX does not auto-retry with a new command ID.
- [ ] Batch partition changes include positive, negative, and fuzz fixtures.
- [ ] Formula worker changes include stale-safe and corruption-rebuild tests.
- [ ] No conserved numeric movement bypasses `NumericLedgerPort`.
- [ ] Financial/stock changes avoid direct mutable balance updates outside the ledger adapter.
- [ ] TigerBeetle migration changes update `docs/plan/post-mvp-tigerbeetle-transition.md` and P1-LEDGER-001 evidence.
- [ ] Compliance-impacting changes reviewed by Compliance Owner.
- [ ] `scripts/validate-pack.sh` passes.

## Required evidence links

Add links in the PR body for:

- CI run
- Benchmark run, if relevant
- Dashboard or metric update, if relevant
- ADR update, if decision changed
- Gate sign-off, if gate status changed
