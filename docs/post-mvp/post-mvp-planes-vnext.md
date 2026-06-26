# Post-MVP Specialized Planes vNext

**Version:** 0.16.1  
**Status:** Detailed post-MVP planning pack; not Phase 0 runtime scope  
**Purpose:** Keep TigerBeetle, pgvector, DuckDB, outbox fan-out, external integration, and tiled UI detail out of the active Phase 0 spec while preserving the interface contracts needed for later adoption.

## Boundary rule

```text
Post-MVP planes are prepared by IDs, schemas, envelopes, manifests, projections, and feature flags.
They are not admitted into the ordinary Phase 0 edit path.
```

## Plane summary

| Plane | Post-MVP role | Phase 0 preparedness only |
|---|---|---|
| TigerBeetle | Authoritative conserved numeric ledger plane for selected ledgers. | `NumericLedgerPort`, append-only MVP transfers, deterministic IDs, field policy, shadow-mode docs. |
| pgvector | Permissioned semantic retrieval over derived chunks. | source/version/classification metadata and `RetrievalRevalidator` contract. |
| DuckDB | Analytical execution over governed Parquet/Arrow snapshots. | export manifests, source high-watermarks, data classification, lineage fields. |
| Outbox fan-out / CDC / broker | External and derived-plane event distribution. | outbox envelope fields, checkpoints, route keys, idempotency keys. |
| External integration adapters | Inbound staging and outbound delivery. | integration staging, service-account scopes, credential refs, negative fixtures. |
| Tiled workspace UI | Power-user layout/lens system after vertical slice. | tile contract, transposed view contract, metadata hooks, UI-008. |

## Interface contracts retained in Phase 0

```text
command_id
correlation_id
trace_id
source_version
object_type
object_id
permission_scope_hash
data_classification
schema_version
payload_hash
payload_ref
route_key
partition_key
feature_flag
```

These fields keep later planes additive. They do not make later planes authoritative.

## Feature-flag policy

Every post-MVP runtime must be disabled by default:

```text
tigerbeetle_runtime_enabled=false
pgvector_retrieval_enabled=false
duckdb_user_analytics_enabled=false
outbox_broker_fanout_enabled=false
external_connector_runtime_enabled=false
tiled_workspace_enabled=false
ai_mutation_suggestions_enabled=false
```

A feature flag can be enabled only after its P1 gate passes and owner sign-off is recorded.

## Authority escalation rule

No derived-plane result becomes business state directly.

```text
Candidate result
  -> deterministic revalidation
  -> user or policy confirmation
  -> command handler
  -> PostgreSQL transaction / future ledger adapter
  -> outbox event
```

## References

| Topic | Canonical docs |
|---|---|
| TigerBeetle target | `docs/data/tigerbeetle-target-model.md`, `docs/data/tigerbeetle-field-assignment-policy.md` |
| Numeric ledger contract | `docs/data/numeric-ledger-contract.md`, `docs/data/ledger-id-derivation-reference.md` |
| pgvector | `docs/data/pgvector-integration-strategy-options.md`, `docs/data/semantic-retrieval-contract.md` |
| DuckDB | `docs/data/duckdb-analytics-plane.md`, `docs/data/analytics-export-contract.md` |
| Outbox fan-out | `docs/data/outbox-integration-strategy-options.md`, `docs/data/event-envelope-contract.md` |
| External integrations | `docs/data/external-integration-contract.md`, `docs/dev/external-integration-adapter.md` |
| Tiled UI | `docs/ui/spreadsheet-tiled-workspace-strategy.md`, `docs/ui/tile-contract.md` |
