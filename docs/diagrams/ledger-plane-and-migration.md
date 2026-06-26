---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "compatibility diagram"
---

# Ledger Plane and Migration Diagrams

This file restores the v0.12.4 ledger-plane diagrams and points to the newer canonical numeric-ledger diagrams in `docs/diagrams/numeric-ledger-plane.md`.

## MVP ledger-ready numeric flow

```mermaid
flowchart LR
    Client[Spreadsheet client] --> API[Command API]
    API --> CMD[command_log]
    API --> Domain[Domain command handler]
    Domain --> ACCT[numeric_accounts]
    Domain --> XFER[numeric_transfers]
    XFER --> PROJ[numeric_balance_projection]
    Domain --> Audit[audit_events]
    Domain --> Events[domain_events]
    Domain --> Outbox[outbox_events]
    Outbox --> SSE[SSE polling delivery]
```

## Post-MVP target boundary

```mermaid
flowchart TB
    subgraph PostgreSQL Control Plane
      CMD[command_log]
      OBJ[domain objects and workflow]
      AUTH[permissions and RLS]
      META[ledger metadata and account dimensions]
      AUD[audit/domain/outbox events]
      PROJ[read projections]
    end

    subgraph TigerBeetle Numeric Ledger Plane
      TBA[accounts]
      TBT[transfers]
      TBP[pending transfers]
    end

    API[Domain command API] --> AUTH
    API --> CMD
    API --> OBJ
    API --> TBA
    API --> TBT
    API --> TBP
    TBT --> PROJ
    TBP --> PROJ
    API --> AUD
```

## Migration lifecycle

```mermaid
sequenceDiagram
    participant PG as PostgreSQL numeric_transfers
    participant SW as Shadow worker
    participant TB as TigerBeetle shadow ledger
    participant REC as Reconciliation job
    participant API as Command API

    Note over PG,TB: MVP: PostgreSQL authoritative
    API->>PG: Insert append-only numeric transfer
    PG->>SW: Ledger shadow queue/outbox
    SW->>TB: Create transfer with deterministic ID
    TB-->>SW: created or exists
    REC->>PG: Read projection
    REC->>TB: Read balance/transfer state
    REC-->>API: Cutover eligibility metric
    Note over API,TB: Post-MVP: selected tenant+ledger becomes TigerBeetle authoritative
```
