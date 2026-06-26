---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "active onboarding overlay"
owner: "Engineering Lead"
---

# Minimal Reading Path

## Purpose

Reduce Day-1 cognitive load. This file tells each role what to read before implementation and what can be deferred.

The main spec and gate cards remain normative. This file is only a navigation overlay.

## Universal first 30 minutes

| Order | Read | Why |
|---:|---|---|
| 1 | `README.md` | Understand the MVP boundary and specialized-plane non-goals. |
| 2 | `docs/pack-index.md` | Find canonical documents and owners. |
| 3 | `docs/onboarding/engineer-onramp-day1.md` | Understand the vertical slice. |
| 4 | `docs/plan/vertical-slice-acceptance-checklist.md` | Know what must pass before broader UX. |
| 5 | `scripts/validate-pack.sh` | Run the pack validation locally. |

## Role-specific reading matrix

| Role | Must read before first PR | Read before touching related area | Defer until P1 evidence |
|---|---|---|---|
| Frontend | `docs/dev/client-optimistic-ui-and-conflicts.md`, `docs/api/command-status-openapi.md`, `docs/api/error-taxonomy.md` | `docs/dev/outbox-polling-reader.md`, `docs/data/outbox-polling-performance-contract.md` | pgvector, DuckDB, TigerBeetle adapter internals. |
| Backend/API | `docs/dev/command-lifecycle.md`, `docs/data/command-outbox-retention-partitioning.md`, `docs/data/event-envelope-contract.md` | `docs/data/numeric-ledger-contract.md`, `docs/data/ledger-id-derivation-reference.md`, `docs/dev/numeric-ledger-plane.md` | CDC/broker rollout, strict TigerBeetle cutover. |
| SRE/Platform | `docs/observability/phase0-observability.md`, `docs/ops/failure-mode-catalog.md`, `docs/ops/outbox-wakeup-runbook.md` | `docs/ops/outbox-fanout-runbook.md`, `docs/qa/chaos-test-plan.md` | Kafka/NATS/cloud-bus production deployment. |
| Security | `invariants/security-invariants.yml`, `docs/compliance/eu-dpa-dsr-matrix.md`, `docs/security/command-log-privacy.md` | `docs/dev/retrieval-revalidator.md`, `docs/data/semantic-retrieval-contract.md` | AI/analytics production access. |
| Data/AI | `docs/data/semantic-retrieval-contract.md`, `docs/dev/retrieval-revalidator.md`, `docs/data/pgvector-integration-strategy-options.md` | `docs/data/analytics-export-contract.md`, `docs/data/duckdb-analytics-plane.md` | dedicated semantic DB rollout. |
| Domain/Finance/Stock | `docs/data/numeric-ledger-contract.md`, `docs/data/ledgerability-classification.md`, `docs/data/tigerbeetle-field-assignment-policy.md` | `docs/qa/ledger-benchmark-plan.md`, `docs/plan/post-mvp-tigerbeetle-transition.md` | TigerBeetle cutover operation. |
| QA | `tests/manifest.yml`, `docs/qa/phase0-benchmark-plan.md`, `docs/qa/chaos-test-plan.md` | `docs/qa/outbox-fanout-benchmark-plan.md`, `docs/qa/ledger-benchmark-plan.md`, `docs/qa/ai-benchmark-plan.md` | broad P1 scale testing before P0 gates pass. |

## Minimal P0 reading bundle

For the first implementation slice, read only:

```text
README.md
docs/pack-index.md
docs/onboarding/engineer-onramp-day1.md
docs/dev/command-lifecycle.md
docs/dev/outbox-polling-reader.md
docs/data/command-outbox-retention-partitioning.md
docs/data/outbox-polling-performance-contract.md
docs/plan/vertical-slice-acceptance-checklist.md
docs/observability/phase0-observability.md
invariants/security-invariants.yml
tests/manifest.yml
```

Everything else is consulted when a PR touches that area.

## Non-normative historical material

Older v0.12.x reviews and changelogs remain in the archive for audit continuity. They are historical unless referenced from `docs/pack-index.md`, `tests/manifest.yml`, or `scripts/validate-pack.sh` as active required documents.


---

## v0.14 external integration note

External integration policies are canonical in `docs/data/external-integration-strategy-options.md` and `docs/data/external-integration-contract.md`. This document may reference those contracts but must not restate connector authority rules.
