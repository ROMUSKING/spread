---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "accepted-post-MVP-target"
---

# ADR-0022: Post-MVP Analytical Plane with DuckDB

## Context

Spreadsheet-native ERP users will need wide scans, ad hoc rollups, pivot-style analysis, exports, support diagnostics, and AI context-pack generation. Running every analytical scan on operational PostgreSQL increases risk to edit-path latency and database contention.

## Decision

Adopt DuckDB after MVP as a derived analytical/export plane over governed projection artifacts, primarily Parquet or Arrow, with optional read-only PostgreSQL replica attach only after evidence.

## Selected strategy

The selected strategy is **Parquet artifact lake + controlled read bridge**:

```text
PostgreSQL projections -> governed export artifacts -> DuckDB query service / local support analysis
```

Direct PostgreSQL access from DuckDB is allowed only in read-only evidence gates or internal diagnostics. DuckDB must not write operational PostgreSQL tables.

## Consequences

- Export contracts and projection versions must be prepared early.
- All artifacts need data classification, permission scope, source watermark, and schema hash.
- Analytics freshness must be explicit.
- Analytical queries must be isolated from the command/edit hot path.
- TigerBeetle remains the numeric authority; DuckDB only analyzes ledger-derived projections.

## Rejected alternatives

- DuckDB as operational state store.
- DuckDB as ledger store.
- Unrestricted DuckDB attach to production PostgreSQL primary.
- AI agent query router over raw operational tables.
