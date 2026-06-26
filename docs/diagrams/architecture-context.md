---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
---

# Architecture Context Diagrams

## C4-style context

```mermaid
flowchart TB
    User[ERP spreadsheet user] --> Browser[Browser grid client]
    Browser --> API[TypeScript API command/query layer]
    Browser --> SSE[SSE connection]

    API --> Auth[Auth/RLS/query policy layer]
    API --> Cmd[Command log]
    API --> DB[(PostgreSQL current-state ERP tables)]
    API --> Audit[(audit_events)]
    API --> Domain[(domain_events)]
    API --> Outbox[(outbox_events)]

    Poller[Outbox polling reader] --> Outbox
    Poller --> SSE
    SSE --> Browser

    API --> Formula[Node worker_threads formula workers]
    Formula --> API

    API --> Metrics[OTEL + Prometheus]
    Poller --> Metrics
    Formula --> Metrics
    Metrics --> SRE[SRE dashboards and alerts]

    Compliance[Compliance owner] -. gates .-> DB
    Security[Security invariant CI] -. release blocker .-> API
```

## Vertical slice timeline

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant L as command_log
    participant D as PostgreSQL TX
    participant O as outbox_events
    participant P as Polling Reader
    participant S as SSE

    C->>A: POST /api/v1/commands (commandId, request_hash)
    A->>L: INSERT received or detect duplicate
    alt duplicate in-flight same hash
        A-->>C: 202 COMMAND_PENDING
    else new command
        A->>D: BEGIN
        D->>D: mutate current-state table
        D->>D: insert audit_event + domain_event
        D->>O: insert outbox_event
        D-->>A: COMMIT
        A->>L: UPDATE committed + redacted response
        A-->>C: 200 terminal outcome
    end
    Note over C,A: Lost response simulation
    C->>A: GET /api/v1/commands/{commandId}
    A-->>C: terminal outcome or ambiguity contract
    P->>O: poll outbox_id > watermark
    P->>S: push envelope to subscribed workbook
    S-->>C: workbook delta or sync_required
```

## Component boundary rules

| Boundary | Rule |
|---|---|
| Browser -> API | Mutations use command identity; no blind retry after ambiguity. |
| API -> PostgreSQL | Current, audit, domain, and outbox writes share one business transaction. |
| Outbox -> SSE | Polling is durable path; `NOTIFY` is wake-up only after benchmark admission. |
| API -> command_log | Store hashes, trace context, redacted responses, and terminal status. |
| API -> formula workers | Resident graph and delta messages only; no full graph clone per edit. |
| CI -> release | Release-blocking invariants must map to executable evidence. |
