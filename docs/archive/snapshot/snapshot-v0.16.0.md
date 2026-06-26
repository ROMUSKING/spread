# START HERE — Spreadsheet-Native ERP v0.16.0 Snapshot

**Version:** 0.16.0  
**Last-reviewed:** 2026-06-26  
**Status:** First-read architecture, repository, and smoke-test snapshot

## Authority map

```mermaid
flowchart LR
    UI[Spreadsheet UI / minimal grid] --> API[command_api]
    API --> PG[(PostgreSQL command/control/outbox)]
    PG --> SSE[Polling-first SSE]
    PG --> AUD[Audit + domain events]
    PG -. post-MVP .-> TB[TigerBeetle numeric ledger plane]
    PG -. post-MVP .-> VEC[pgvector semantic retrieval]
    PG -. post-MVP .-> DDB[DuckDB analytics snapshots]
    PG -. post-MVP .-> EXT[External integrations]
```

## Repository tree

```text
repo/
  apps/
    api/       command API, command status, outbox poller, SSE, integration staging stubs
    web/       minimal spreadsheet UI shell and command-status client
  packages/
    domain/    command/domain types, policies, NumericLedgerPort contract
    db/        migrations, transaction helpers, RLS and SQL invariant wiring
    contracts/ shared API/event contracts
    config/    runtime flags and environment parsing
    observability/ trace and metric wrappers
    testkit/   evidence and fixture helpers
    ui/        reusable UI contracts/components after grid DAR
  docs/        active docs plus docs/archive for historical release material
  invariants/  invariant manifests and SQL invariant checks
  tests/       manifest and fixtures
  scripts/     validation and smoke-test utilities
```


## Repository tree diagram

```mermaid
flowchart TD
    R[repo] --> A[apps]
    A --> API[api]
    A --> WEB[web]
    R --> P[packages]
    P --> DOMAIN[domain]
    P --> DB[db]
    P --> CONTRACTS[contracts]
    P --> CONFIG[config]
    P --> OBS[observability]
    P --> TESTKIT[testkit]
    P --> UI[ui]
    R --> DOCS[docs]
    R --> INVARIANTS[invariants]
    R --> TESTS[tests]
    R --> SCRIPTS[scripts]
```

## Phase 0 target

```text
one safe spreadsheet edit
  -> command_log claim
  -> PostgreSQL business transaction
  -> audit/domain/outbox events
  -> polling-first SSE
  -> command-status recovery
```

## What agents may NOT do today

```text
1. Do not bypass command_api for any mutation.
2. Do not bypass outbox_events for outbound events or live updates.
3. Do not add TigerBeetle, pgvector, DuckDB, broker/CDC, or external connector runtime to Phase 0.
4. Do not build full tiled workspace before the vertical slice is green.
5. Do not weaken validation, smoke typecheck, or invariants to make a PR pass.
```

## Required first commands

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
```

Start coding only after reading:

```text
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
docs/implementation/project-directory-structure.md
```

## First coding path

```text
AGENT-000 repository bootstrap
  -> AGENT-001 test/evidence harness
  -> AGENT-010 command_log schema
  -> AGENT-011 command status API
  -> AGENT-012 command transaction boundary + MVP NumericLedgerPort
```
