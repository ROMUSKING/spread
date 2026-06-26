---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "v0.13 strategy options; selected model normative"
---

# System Plane Strategy Options

## Decision summary

The selected v0.13 strategy is **hub-and-spoke specialized planes**:

```text
PostgreSQL control plane
  + TigerBeetle numeric ledger plane
  + pgvector semantic retrieval plane
  + DuckDB analytics plane
  + TypeScript formula/compute workers
  + durable outbox/SSE delivery plane
```

PostgreSQL remains the hub for command authority, tenancy, permissions, workflow, audit, outbox, metadata, and projection lineage. Specialized planes consume explicitly versioned projections or deterministic commands. They must not mutate each other directly.

## Evaluation criteria

| Criterion | Meaning |
|---|---|
| Correctness | Protects command, audit, permission, ledger, and outbox invariants. |
| MVP fit | Does not increase Phase 0/vertical-slice scope. |
| Query performance | Supports analytics/semantic/ledger workloads without harming OLTP. |
| Migration ease | Can be adopted by adapter/projection migration rather than domain rewrite. |
| Operational load | Adds manageable failure modes and observability surfaces. |
| Cognitive load | New engineers can still understand the system boundary. |

## Option A: PostgreSQL-only monolith

**Score:** 6.6/10.

```text
PostgreSQL handles OLTP, numeric movement, analytics, embeddings, reporting, audit, outbox, and projections.
```

**Strengths:** lowest initial operational complexity, simplest local development, one backup/recovery posture.

**Weaknesses:** analytical scans, vector indexes, and numeric ledger contention can compete with edit latency; conserved numeric movement must be reimplemented; long-running reports risk harming OLTP query plans.

**Decision:** acceptable for MVP preparation, rejected as the post-MVP target.

## Option B: Hub-and-spoke specialized planes — selected

**Score:** 9.4/10.

```text
PostgreSQL = control/projection/audit hub
TigerBeetle = conserved numeric movement
pgvector = semantic retrieval over permissioned chunks
DuckDB = read-heavy analytics/export/reconciliation over snapshots
```

**Strengths:** isolates workload classes, keeps command authority centralized, lets each tool do one job, and preserves strong migration boundaries.

**Weaknesses:** requires more contracts, reconciliation, operational metrics, and failure-mode documentation.

**Decision:** selected. Use this strategy for post-MVP planning.

## Option C: Warehouse/lakehouse-first analytics

**Score:** 8.0/10 post-MVP, 4.5/10 for MVP.

```text
PostgreSQL emits events into object storage/lakehouse first; analytics primarily happens outside PostgreSQL.
```

**Strengths:** strong for large-scale analytics and long-term BI.

**Weaknesses:** heavy governance and platform work; weaker fit for Phase 0; higher latency for operational analytics; more data-residency complexity.

**Decision:** keep as a later scale path. DuckDB Parquet snapshots are a lightweight bridge to this model.

## Option D: Read replica + materialized views only

**Score:** 7.4/10.

**Strengths:** familiar PostgreSQL operations, avoids a new engine.

**Weaknesses:** still pushes analytical SQL planning/storage into PostgreSQL; materialized-view refresh and retention can become their own platform.

**Decision:** useful transition pattern, not final target for heavy analytics.

## Option E: Embedded DuckDB in API process

**Score:** 5.9/10.

**Strengths:** simple to prototype and fast for local exports.

**Weaknesses:** unsafe resource coupling to the edit/API path; hard to isolate memory and CPU; can make analytics failures user-request failures.

**Decision:** rejected. DuckDB must run in isolated analytics workers or controlled offline jobs.

## Option F: Direct DuckDB PostgreSQL attach for customer analytics

**Score:** 5.2/10.

**Strengths:** avoids snapshot plumbing and can be fast for some internal analysis.

**Weaknesses:** risks production PostgreSQL load amplification; hard to guarantee tenant/permission filtering if arbitrary SQL is allowed.

**Decision:** allowed only for internal spike evidence or controlled admin jobs. Default customer-facing strategy is snapshots.

## Option G: AI/vector-first integration

**Score:** 4.3/10.

**Weaknesses:** semantic similarity is not deterministic authorization, accounting, inventory, or reporting logic. It cannot replace command handlers, TigerBeetle, or DuckDB.

**Decision:** rejected. pgvector is retrieval support, not a decision authority.

## Option H: Ledger-to-DuckDB direct pipeline bypassing PostgreSQL

**Score:** 5.0/10.

**Weaknesses:** loses ERP metadata, permissions, workflow context, command lineage, and outbox consistency.

**Decision:** rejected. TigerBeetle facts must be exposed to analytics through PostgreSQL ledger projections and reconciliation manifests.


## Option I: DuckLake/Quack analytics service

**Score:** 7.8/10 later, not MVP.

**Strengths:** may support broader concurrent analytics/lakehouse patterns while keeping DuckDB-family tooling.

**Weaknesses:** changes runtime/catalog/security boundaries and requires a separate production-readiness ADR.

**Decision:** future evaluation only after snapshot-first DuckDB artifacts prove value.

## Selected integration pattern

```text
Command writes and state changes
  -> PostgreSQL command/audit/domain/outbox/projections
  -> TigerBeetle for ledger-shaped numeric movement after cutover
  -> pgvector for permissioned semantic retrieval after P1-AI gate
  -> DuckDB for analytics snapshots and export jobs after P1-ANALYTICS gate
```

## Non-negotiable synergy rules

1. Specialized planes consume contracts; they do not define domain truth.
2. Cross-plane flows use deterministic IDs, high-watermarks, schema hashes, and lineage records.
3. User-visible mutations always return to command handlers.
4. Permission filtering happens before user-visible retrieval or analytics output.
5. Every plane has a fail-closed degradation path.


## v0.13 integration refinement

The selected model is not merely a collection of databases. It is a command-centered architecture with strict authority boundaries:

```text
Command layer       -> mutation authority
PostgreSQL          -> operational truth and projection lineage
TigerBeetle         -> numeric conservation after cutover
pgvector            -> semantic narrowing over approved chunks
DuckDB              -> deterministic analytics over governed artifacts
Outbox/SSE          -> durable delivery and freshness watermarks
Formula workers     -> derived compute over dependency graphs
Security/compliance -> release-blocking admissibility gates
```

A future plane can be added only if it satisfies the same rule: consume versioned contracts, produce derived/rebuildable outputs unless explicitly authoritative by ADR, and never bypass command/audit/permission boundaries.

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
