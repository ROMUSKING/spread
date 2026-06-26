# External Integration Benchmark Plan v0.14.2

## BENCH-INTEGRATION-001: Outbound webhook dispatcher

Dataset:

```text
10 tenants
100 external systems
10k outbox events
100k delivery attempts including retries
payload sizes p50/p95/p99 recorded
```

Targets:

```text
outbound_dispatch_p95_ms <= 250
outbound_delivery_lag_p99_s <= 60
command_commit_delta_p95_ms <= 0 for external outage scenario
regulated_export_escape_count = 0
```

## BENCH-INTEGRATION-002: Inbound webhook intake

Targets:

```text
signature_validation_p95_ms <= 25
inbound_dedupe_p95_ms <= 30
command_proposal_creation_p95_ms <= 200
same-key-different-payload conflict detected = 100%
```

## BENCH-INTEGRATION-003: Pull/import reconciliation

Targets:

```text
10k external rows staged under 30s
mapping conflict report generated under 10s
no direct operational writes from import worker
```

## BENCH-INTEGRATION-004: Derived-plane external data routing

Targets:

```text
external pgvector chunks require classification and RetrievalRevalidator
external DuckDB snapshots require manifest and source lineage
external ledger-affecting data enters through command handlers
```

## Required evidence metadata

```text
tenant count
external system count
payload size distribution
retry rate
error rate
schema versions
credential mode
PostgreSQL version
Node.js version
git SHA
```


## BENCH-INTEGRATION-007: High-volume inbound staging under rate-limit pressure

Dataset: `tests/fixtures/integration/pilot-v1-small-import.json` plus generated 10k-row variants. Must cover scan/quarantine, schema validation, rate-limit pressure, connector outage, idempotency duplicates, and same-key/different-payload conflicts.
