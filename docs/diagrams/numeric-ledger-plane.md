---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "architecture diagram"
---

# Numeric Ledger Plane Diagrams

## MVP to post-MVP boundary

```mermaid
flowchart LR
    UI[Spreadsheet UI] --> API[Command API]
    API --> AUTH[Authorization and workflow policy]
    AUTH --> DOMAIN[Domain command handler]
    DOMAIN --> PORT[NumericLedgerPort]
    PORT --> MVP[PostgresMvpNumericLedgerAdapter]
    MVP --> NACC[numeric_accounts]
    MVP --> NTR[numeric_transfers]
    MVP --> NBAL[numeric_balance_projection]
    DOMAIN --> AUD[audit_events]
    DOMAIN --> EVT[domain_events]
    DOMAIN --> OUT[outbox_events]
    OUT --> SSE[SSE polling delivery]

    PORT -. post-MVP same interface .-> TB[TigerBeetleNumericLedgerAdapter]
    TB -.-> TBA[Accounts]
    TB -.-> TBT[Transfers]
    TB -.-> TBB[Balances]
```

## Numeric command sequence in MVP

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Domain
    participant Ledger as NumericLedgerPort
    participant PG as PostgreSQL MVP Ledger
    participant Outbox

    Client->>API: POST command with commandId
    API->>Domain: validate auth, workflow, domain state
    Domain->>Domain: derive account IDs and transfer IDs
    Domain->>Ledger: postTransferGroup(plan)
    Ledger->>PG: INSERT numeric_transfers idempotently
    Ledger->>PG: UPDATE projection from transfer deltas
    Domain->>PG: write domain state and audit/domain event
    Domain->>Outbox: write outbox_event with ledger_group_id
    API-->>Client: terminal command result
```

## Post-MVP migration stages

```mermaid
flowchart TD
    MVP[mvp: PostgreSQL authoritative] --> Freeze[model_freeze]
    Freeze --> Replay[historical_replay]
    Replay --> Passive[passive_shadow]
    Passive --> Strict[strict_shadow]
    Strict --> Cutover[cutover: TigerBeetle authoritative for scope]
    Cutover --> Recon[continuous reconciliation]
    Passive --> Defer[defer or fix model]
    Strict --> Defer
    Cutover --> Rollback[rollback posture: pause or route new commands back]
```

## Passive and strict shadow mode

```mermaid
flowchart TD
    Plan[Domain numeric movement plan] --> PGAdapter[Postgres MVP adapter]
    PGAdapter --> PGProjection[PostgreSQL projection]
    PGAdapter --> ShadowQueue[durable ledger shadow queue]
    ShadowQueue --> TBAdapter[TigerBeetle shadow adapter]
    TBAdapter --> TBAccounts[TigerBeetle accounts]
    PGProjection --> Recon[Reconciliation report]
    TBAccounts --> Recon
    Recon --> Decision{Cutover safe?}
    Decision -- yes --> Cutover[Mark ledger authoritative_engine=tigerbeetle]
    Decision -- no --> Fix[Fix model or defer]
```

## Post-cutover recovery path

```mermaid
sequenceDiagram
    participant API
    participant TB as TigerBeetle
    participant PG as PostgreSQL
    participant Repair as Recovery Worker

    API->>PG: command_log received
    API->>PG: validate domain state and permissions
    API->>TB: create_transfers deterministic IDs
    TB-->>API: created or exists
    API->>PG: commit domain/projection/audit/outbox/command status
    alt PostgreSQL commit fails after TigerBeetle success
      Repair->>TB: lookup_transfers expected IDs
      Repair->>PG: repair projection/outbox/command status
    end
```
