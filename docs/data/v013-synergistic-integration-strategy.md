---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "normative architecture strategy"
owner: "Engineering Lead"
---

# v0.13 Synergistic System Integration Strategy

## Decision

v0.13 promotes the architecture from separate post-MVP plane documents into a single system-level strategy.

The selected model is:

```text
Command-centered hub with derived specialized planes
```

PostgreSQL remains the control and projection hub. Specialized planes are admitted only when they consume explicit contracts and improve correctness, performance, or explainability without becoming hidden sources of truth.

## Source-of-truth map

| System element | Authoritative for | Consumes | Produces | Must not do |
|---|---|---|---|---|
| Command layer | mutation intent, idempotency, unknown-outcome recovery | client commands, policies | command status, audit/domain/outbox records | bypass domain handlers |
| PostgreSQL | business objects, permissions, workflow, audit, outbox, projections | command transactions | current state, read models, export/embedding sources | absorb all post-MVP OLAP/vector/ledger pressure |
| Durable outbox | delivery/replay watermark | committed command transaction | SSE envelopes, export jobs, embedding jobs | replace audit/domain truth |
| TypeScript formula workers | formula dependency graph and recalculation | projection deltas | formula result projections | mutate source-of-truth rows |
| Batch partition compiler | transactional-batch safety | domain policies, dependency edges | partition plan and validation evidence | prove arbitrary independence |
| Rate limiter | hot-path admission control | request/session/tenant context | local throttle decisions and coarse observations | synchronously write ordinary edit counters to PostgreSQL |
| TigerBeetle | conserved numeric movement after cutover | `NumericLedgerPort` movement plans | authoritative transfer/balance facts | own workflow, permissions, or metadata |
| pgvector | semantic retrieval over approved chunks | permissioned chunk projections | relevant context candidates | authorize or mutate |
| DuckDB | governed analytics/export/simulation | approved artifacts/read-only projections | analytical result artifacts | write operational state or compute numeric truth |
| Security/compliance layer | release-blocking boundaries | manifests, classifications, CI evidence | sign-off/block decisions | become prose-only guidance |

## Selected cross-plane flow

```text
client command
  -> command layer validates idempotency
  -> domain handler validates permissions/workflow/business rules
  -> PostgreSQL transaction writes current state + audit + domain + outbox
  -> NumericLedgerPort records conserved movement when applicable
  -> outbox drives SSE, export jobs, embedding jobs, and reconciliation jobs
  -> formula workers, pgvector, DuckDB, and dashboards consume versioned projections/artifacts
```

## Alternative integration strategies evaluated

| Strategy | Summary | Score | Decision |
|---|---|---:|---|
| A. PostgreSQL-only monolith | Keep OLTP, ledger, analytics, semantic retrieval, formulas, and outbox entirely in PostgreSQL/application code. | 6.4 | MVP fallback only. |
| B. Command-centered hub with derived specialized planes | PostgreSQL command/control hub plus TigerBeetle, pgvector, DuckDB, formula workers, and outbox as bounded planes. | **9.4** | **Selected for v0.13.** |
| C. Event/lakehouse-first architecture | Emit every domain fact to a lake/event platform first; build reads from the lake. | 7.2 | Later scale path, too heavy for MVP/post-MVP evidence. |
| D. PostgreSQL extension-heavy model | Use pgvector and pg_duckdb inside PostgreSQL, minimizing external services. | 7.5 | Good later option, but must not couple analytics to OLTP without evidence. |
| E. Microservice-per-plane model | Each plane owns its own service/database and APIs. | 6.8 | Too much operational and cognitive load early. |
| F. AI/query-router first model | LLM or semantic router chooses PostgreSQL/TigerBeetle/DuckDB dynamically. | 4.0 | Rejected until deterministic APIs, permissions, and source references are mature. |
| G. DuckDB/analytics-first model | Build reporting/export/pivot layer before command/ledger/outbox foundations are proven. | 3.8 | Rejected; violates Phase 0 order. |
| H. TigerBeetle-first full rewrite | Move all numeric and some domain state into ledger accounts/transfers immediately. | 5.6 | Too disruptive for MVP; use NumericLedgerPort and staged cutover. |
| I. Customer scripting/platform model | Allow tenant-defined code/SQL/formulas to span all planes. | 3.5 | Rejected until extension sandbox exists. |
| J. Warehouse-first enterprise model | External warehouse becomes default analytical read path. | 6.9 | Defer until artifact-plane evidence shows need. |

## Why the selected strategy wins

The selected model scores highest because it creates **clear authority boundaries**:

```text
Commands decide whether a mutation may happen.
PostgreSQL records operational truth and projection lineage.
TigerBeetle proves numeric movement when cut over.
pgvector retrieves semantic context.
DuckDB computes analytical aggregates over governed artifacts.
Outbox connects everything with durable watermarks.
```

The system becomes more capable without letting any specialized plane bypass the mutation, permission, audit, or compliance model.

## Synergy contracts

### Contract 1: Shared identity envelope

Every cross-plane artifact should carry:

```text
tenant_id
object_type
object_id
command_id
request_trace_id
movement_group_id optional
source_version
projection_version
source_high_watermark_outbox_id
data_classification
permission_scope_hash
schema_hash
```

### Contract 2: Single mutation authority

No specialized plane may directly mutate source-of-truth business records. A suggestion, report, assistant action, or reconciliation fix must become a command.

### Contract 3: Projection-first reads

Specialized planes read named projections or governed artifacts, not raw operational tables by default.

### Contract 4: Deterministic truth before probabilistic context

pgvector can retrieve context. DuckDB can aggregate analytics. Neither can decide authorization or financial/stock truth. Deterministic PostgreSQL/TigerBeetle-derived facts must anchor user-visible answers.

### Contract 5: Fail-closed degradation

If a derived plane is stale, unavailable, or inconsistent:

```text
edit path continues;
live updates continue from outbox;
analytics/AI features degrade or return stale/unavailable;
commands never retry blindly;
ledger reconciliation blocks cutover where needed.
```

## Plane interaction matrix

| From -> To | Allowed pattern | Rejected pattern |
|---|---|---|
| Command -> PostgreSQL | transactional current/audit/domain/outbox commit | partial domain write outside command log |
| Command -> TigerBeetle | `NumericLedgerPort` adapter with deterministic IDs | ad hoc transfer writes from UI or AI |
| PostgreSQL -> pgvector | source-versioned permissioned chunks | embeddings of raw regulated tables |
| PostgreSQL -> DuckDB | governed artifact/export manifest or read-only projection bridge | arbitrary customer SQL over primary DB |
| TigerBeetle -> DuckDB | reconciled PostgreSQL ledger projection | direct ledger scrape without ERP metadata |
| pgvector -> DuckDB | candidate IDs/context then deterministic aggregate | vector result as numeric truth |
| DuckDB -> Command | report suggests command draft | direct operational writeback |
| Formula worker -> PostgreSQL | materialized formula projection/status | source-of-truth mutation |
| Outbox -> all derived planes | durable high-watermark jobs | best-effort hidden sync |

## MVP preparation checklist

MVP should prepare v0.13 without expanding Phase 0 scope:

1. Keep all mutable actions command-owned.
2. Preserve outbox high-watermarks and replay contracts.
3. Add projection version and schema hash fields where practical.
4. Add data classification and permission-scope concepts to read models.
5. Keep conserved numeric movement behind `NumericLedgerPort`.
6. Keep formula results distinguishable from operational source-of-truth values.
7. Keep export/embed/analytics eligibility as explicit policy, not implicit table access.
8. Keep trace/correlation IDs across command, audit, outbox, ledger, export, and retrieval jobs.

## v0.13 non-goals

- No DuckDB, pgvector, or TigerBeetle runtime dependency in the Phase 0 vertical slice.
- No AI mutation path.
- No customer arbitrary SQL.
- No direct DuckDB access to operational writer.
- No vector-based permissions.
- No ledger bypass through analytics.
- No event-stream replacement for current-state operational tables.

## Acceptance criteria

v0.13 is accepted when:

```text
- the selected strategy is documented and linked from pack-index;
- ADR-0023 records the system-level decision;
- P1-SYNERGY-001 exists as an evidence gate;
- SLOs/manifest/invariants include cross-plane lineage and degradation checks;
- validate-pack.sh fails if the strategy docs or evidence wiring disappear.
```

## pgvector strategy refinement

The pgvector plane uses the selected model from `docs/data/pgvector-integration-strategy-options.md`:

```text
permissioned derived chunk registry
+ hybrid lexical/vector retrieval
+ evidence-gated ANN indexes
+ optional dedicated semantic PostgreSQL/pgvector database after scale evidence
```

This means pgvector is not a broad AI query router and not an authorization or mutation plane. It narrows context; deterministic PostgreSQL, TigerBeetle-derived projections, and DuckDB analytics provide facts. User-visible retrieval requires permission, classification, and source-version revalidation.


---

## v0.14 external integration extension

External systems are added as a post-MVP connector plane. They do not become a source of operational mutation authority.

```text
Inbound external data -> integration intake/staging -> command proposal/submission -> command handler
Outbound external data -> committed outbox envelope -> integration dispatcher -> external system
```

This preserves PostgreSQL command/outbox authority while allowing later integrations with SaaS APIs, webhooks, SCIM, file/batch exchange, DuckDB snapshots, pgvector content feeds, and TigerBeetle reconciliation workflows.
