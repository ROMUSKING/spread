# Phase 0 Risk Register

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

Scoring: probability and impact use 1-5. Exposure = probability x impact. Mitigation confidence uses 1-5 where 5 means high confidence.

| ID | Risk | Prob | Impact | Exposure | Mitigation confidence | Mitigation | Owner | Status |
|---|---|---:|---:|---:|---:|---|---|---|
| R-001 | Pack drift between spec, gates, and ADRs | 4 | 4 | 16 | 4 | Single-source rule, pack index, validation script, CI workflow, weekly review | Engineering Lead | Active |
| R-002 | 10k-row partition compiler becomes hot-path bottleneck | 3 | 5 | 15 | 3 | Union-Find implementation, 10k fixture, timeout fail-closed behavior | Backend/Domain Owner | Active |
| R-003 | Command idempotency weakened by partitioning or TTL cleanup | 3 | 5 | 15 | 4 | Preserve `(tenant_id, command_id)` uniqueness, tenant-hash scale path, TTL ambiguity rules | API/Client Owner | Active |
| R-004 | Outbox polling lag grows with tenant scale | 3 | 4 | 12 | 3 | Covering indexes, outbox_id range partition scale path, local-subscriber filtering | SRE Owner | Active |
| R-005 | Heartbeat races over-allocate rate budget | 2 | 3 | 6 | 4 | Active count plus headroom, stale cleanup, eventual-consistency contract | Platform/API Owner | Active |
| R-006 | Formula worker stale state leaks decision-critical values | 3 | 5 | 15 | 3 | Stale-safe blocking, corruption rebuild, decision-critical rollout gate | Formula Owner | Active |
| R-007 | Compliance scope expands after pilot data arrives | 3 | 5 | 15 | 4 | EU DPA/DSR matrix, regulated-data block until sign-off | Compliance Owner | Active |
| R-008 | RateLimit draft semantics change before production | 2 | 3 | 6 | 3 | Track draft; maintain fallback headers and contract tests | Platform/API Owner | Watch |
| R-009 | New engineer starts broad UX work before vertical slice | 3 | 4 | 12 | 5 | Day-1 onramp, minimal-scope overlay, Week-1 ticket plan | Engineering Lead | Active |
| R-010 | Client optimistic state hides conflict or ambiguous outcome | 3 | 4 | 12 | 3 | Client conflict doc, command-status recovery tests, SSE snapshot gate | Frontend Owner | Active |
| R-011 | MVP numeric model drifts away from TigerBeetle-compatible account/transfer semantics | 3 | 5 | 15 | 3 | `NumericLedgerPort`, deterministic IDs, no direct balance updates, shadow-mode migration gate | Domain Ledger Owner | Active |

## Top risk focus

The top risks by exposure are partition compiler performance/correctness, command idempotency under scale, numeric-ledger model drift, and compliance scope expansion. Each must have owner-visible evidence before broad Phase 0 feature work starts.


## v0.13 Post-MVP data-plane risks

| Risk | Probability | Impact | Exposure | Mitigation | Owner |
|---|---:|---:|---:|---|---|
| DuckDB artifact export leaks regulated data | 2 | 5 | 10 | Classification gates, artifact allow-list, compliance sign-off, regression CI. | Security/Compliance |
| DuckDB analytical scans overload PostgreSQL read replica | 3 | 4 | 12 | Prefer Parquet artifacts, cap direct attach, query limits, SRE monitoring. | SRE |
| pgvector retrieval bypasses permissions | 2 | 5 | 10 | Permission-scope filters before retrieval results, AI invariants, CI. | Security |
| AI answer treats DuckDB/vector output as numeric truth | 3 | 4 | 12 | Deterministic source references, TigerBeetle/PostgreSQL projections for facts. | Data Platform |
| Too many derived planes create cognitive load | 3 | 3 | 9 | Post-MVP data-plane index, gates, owners, and non-goals. | Engineering Lead |


| Post-MVP broker/CDC adoption creates delivery drift or operational load | 3 | 5 | 15 | MVP stays polling-first; P1-OUTBOX-001 requires shadow parity, consumer idempotency, WAL/broker alerts, and rollback drill. | Platform/SRE Owner | Medium | Open |
| Derived planes invent separate event feeds | 4 | 4 | 16 | Outbox envelope contract and OUTBOX invariants require all derived-plane scheduling from governed envelopes/manifests. | Data Platform Owner | High | Mitigated by v0.13.2 |

## v0.13.2 risk heatmap summary

| Risk cluster | Exposure | Current control | Next evidence |
|---|---:|---|---|
| Outbox polling regression from envelope/fan-out bloat | High | `docs/data/outbox-polling-performance-contract.md`, covering indexes, `BENCH-LIVE-OUTBOX-POLL-001` | EXPLAIN and high-churn chaos run. |
| Ledger ID derivation drift across adapters | High | `docs/data/ledger-id-derivation-reference.md`, `LEDGER-008` | SQL/TS/shadow parity + fuzz tests. |
| Derived-plane authority creep | High | `RetrievalRevalidator`, `AI-006`, `SYNERGY-004` | Revalidator API contract and integration tests. |
| Cross-plane failure cascade | Medium-high | `docs/ops/failure-mode-catalog.md`, mixed-plane chaos scenarios | `ci://tests/chaos/mixed-plane-failure-cascade`. |
| Cognitive load / doc drift | Medium | minimal reading path + normative source map | Validation and owner review. |


## v0.14 external integration risks

| Risk | Probability | Impact | Exposure | Mitigation | Owner |
|---|---:|---:|---:|---|---|
| Connector bypasses command handlers | 2 | 5 | 10 | EXT-001, P1-INTEGRATION-001, code review checklist, validation forbid patterns | API Owner |
| External schema drift corrupts mapping | 3 | 4 | 12 | schema_version, payload_hash, mapping conflict state, replay fixtures | Product Integration Owner |
| Credential leak through logs/payloads | 2 | 5 | 10 | secret_ref only, log scanner, integration security boundary | Security Owner |
| Regulated data exported accidentally | 2 | 5 | 10 | data_classification ceiling, Compliance sign-off, EXT-004 | Compliance Owner |
| Connector outage back-pressures command path | 2 | 4 | 8 | async outbox delivery, command commit delta benchmark | SRE Owner |

## v0.14.1 additional risks

| Risk | Probability | Impact | Mitigation |
|---|---:|---:|---|
| External malicious payload reaches command proposal | 2 | 5 | scan/quarantine + schema validation + EXT-009 |
| Integration credential scope too broad | 3 | 5 | service accounts + ADR-0026 + secret audits |
| Connector marketplace bypasses command/outbox boundary | 2 | 5 | SDK import restrictions and CI |
| Tile workspace complexity slows MVP | 3 | 3 | Phase 0 only side detail/transpose scaffold |
| Transposed edit diverges from grid semantics | 2 | 5 | UI-001/UI-002 + same command tests |
| Tile subscription bloat harms outbox polling | 3 | 4 | workspace subscription manifest + BENCH-UX-003 |
