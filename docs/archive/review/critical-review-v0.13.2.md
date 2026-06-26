---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "review closure"
owner: "Engineering Lead"
---

# Critical Review v0.13.2: Outbox, Ledger, Revalidation, and Operability Closure

## Review items addressed

| Review concern | Closure |
|---|---|
| Cognitive and maintenance load remains high | Added `docs/onboarding/minimal-reading-path.md` and `docs/maintenance/normative-source-map.md`. Pack index now points to minimal role-based reading. |
| Outbox envelope bloat could regress MVP polling reader | Added `docs/data/outbox-polling-performance-contract.md`, SLOs for poll SQL/cycle/payload fetch, covering-index requirements, EXPLAIN expectations, and bloat chaos scenario. |
| Deterministic ledger ID derivation remains brittle | Added `docs/data/ledger-id-derivation-reference.md` as the single ID derivation source with TypeScript + SQL reference implementations, test vectors, and property-based parity tests. Added `LEDGER-008`. |
| Derived-plane authority creep | Added `docs/dev/retrieval-revalidator.md`, `docs/api/retrieval-revalidator.openapi.yml`, revalidation requirements in AI/SYNERGY gates, and revalidator invariants/tests. |
| Observability too high-level | Expanded `docs/observability/phase0-observability.md` with outbox, ledger, retrieval, and mixed-plane spans/metrics/alerts. |
| Chaos coverage too shallow | Expanded `docs/qa/chaos-test-plan.md` and added `docs/ops/failure-mode-catalog.md` with top 20 failures. |
| Validation script catches structure more than semantics | Strengthened `scripts/validate-pack.sh` with review-closure checks for new contracts, revalidator, ID parity, polling budgets, forbidden direct-mutation phrases, and required manifest entries. |
| SLO targets lack rationale | Added `docs/slo-target-rationale.md`. |
| AI guardrails need concrete enforcement | Added revalidator service, retrieval OpenAPI, audit requirements, and explicit command-proposal behavior. |
| Rate limiting/bot detection should be tied to P0-RATE | Updated rate-limiter guidance and validation checks for credential-stuffing controls. |

## MVP posture unchanged

MVP remains:

```text
command-first
polling-first
PostgreSQL control plane
invariant CI
derived planes post-MVP and evidence-gated
```

No broker, CDC, TigerBeetle, pgvector, or DuckDB dependency is added to the Phase 0 vertical slice.
