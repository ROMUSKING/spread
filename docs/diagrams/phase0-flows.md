# Phase 0 Flow Diagrams

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Command lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Business
    participant SSE
    Client->>API: POST /api/v1/commands with commandId, request_hash, correlation_id
    API->>DB: INSERT command_log status=received, trace_id
    API->>Business: Execute validated mutation
    Business->>DB: TX current table update plus audit_events plus domain_events plus outbox_events
    DB-->>Business: Commit
    API->>DB: UPDATE command_log status=committed, response_body_redacted_hash
    API-->>Client: 200 response
    DB-->>SSE: outbox_events visible to polling reader
    Note over Client,API: If HTTP response is lost
    Client->>API: GET /api/v1/commands/{commandId}
    API-->>Client: committed, rejected, failed, received, or ambiguous
```

## Outbox polling and demand filtering

```mermaid
flowchart LR
    A[Command transaction commits] --> B[outbox_events]
    B --> C[Polling reader by outbox_id high watermark]
    C --> D{Tenant has local subscribers?}
    D -- No --> E[Advance local watermark without payload fetch]
    D -- Yes --> F{Workbook has local subscribers?}
    F -- No --> E
    F -- Yes --> G[Fetch payload]
    G --> H[Push SSE envelope]
    H --> I[Update connection watermark]
    I --> J{Gap or budget exceeded?}
    J -- Yes --> K[Trigger full workbook refresh]
    J -- No --> C
```

## Batch partition graph example

```mermaid
graph TD
    A[Edit Product 17 cost] --> B[Sku 42 FK product_id]
    A --> C[InventoryValueByProduct aggregate]
    A --> D[Formula Available]
    E[Edit Warehouse 8 note]
    subgraph Partition_1
        A
        B
        C
        D
    end
    subgraph Partition_2
        E
    end
```

## Rate limiter layers

```mermaid
flowchart TB
    R[Request] --> L1[Edge limiter]
    L1 --> L2[Instance token bucket]
    L2 --> L3[Budget division from active heartbeat count]
    L3 --> H{High risk command?}
    H -- No --> B[Business transaction]
    H -- Yes --> L4[Coarse PostgreSQL ceiling]
    L4 --> B
    B --> O[Async observation flush]
```


## See also

- `docs/diagrams/architecture-context.md` for C4-style architecture and vertical-slice sequence.
