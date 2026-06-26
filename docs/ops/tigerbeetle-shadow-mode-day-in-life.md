---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "P1 operational-readiness note"
owner: "SRE Owner + Domain Ledger Owner"
---

# TigerBeetle Shadow Mode Day-in-the-Life

## Purpose

Make passive and strict shadow mode operationally realistic before any TigerBeetle cutover. Shadow mode must provide evidence without silently adding edit-path fragility.

## Daily operating loop

| Time | Operator action | Evidence |
|---|---|---|
| Start of day | Confirm affected ledgers remain in `shadow` or `strict_shadow`, not `tigerbeetle_authoritative`. | ledger registry snapshot. |
| Every hour | Check `ledger_shadow_mismatch_count`, `erp.ledger.shadow_post` p95/p99, and reconciliation lag. | dashboard://ledger-shadow. |
| After deploy | Run ID derivation and payload hash parity tests against a sampled command window. | `ci://tests/ledger/id-derivation-cross-adapter-parity`. |
| End of day | Reconcile PostgreSQL numeric projections against TigerBeetle shadow transfer/account lookups. | reconciliation report URI. |

## Resource-watch items

| Resource | Watch | Initial alert |
|---|---|---|
| API commit path | strict-shadow enqueue overhead, not external post latency | p95 overhead > 100 ms for 10m. |
| Shadow worker | queue depth and retry count | shadow lag p99 > 60s. |
| PostgreSQL | projection rebuild and mirror-index query plans | broad sequential scan in pilot dataset. |
| TigerBeetle client | request latency, result classes, idempotent `exists` outcomes | sustained increase in retryable failures. |
| Reconciliation | mismatch count and classification | any non-zero mismatch after warmup. |

## Strict-shadow rule

Strict shadow may delay command completion only if the P1 gate explicitly admits that behavior for the tested ledger family. Until then, shadow posting must be asynchronous and must not block the Phase 0 edit path.

## Required tests

- `ci://tests/ledger/shadow-mode-day-in-life-runbook-reviewed`
- `ci://tests/ledger/shadow-worker-does-not-block-mvp-edit-path`
- `ci://tests/ledger/shadow-reconciliation-pg-vs-tigerbeetle-criteria`


## Strict shadow, blocking versus non-blocking

Strict shadow, blocking behavior is prohibited for MVP edit paths unless P1-LEDGER-001 explicitly admits it for a tested ledger family. The default is non-blocking shadow enqueue plus reconciliation.
