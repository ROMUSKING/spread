---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "post-MVP SDK guardrail"
---

# External Adapter SDK Contract

Allowed adapter outputs are `stage_import`, `command_proposal`, and `delivery_attempt_result`.

Adapters must not import or call operational repositories, domain writers, command log writer internals, outbox writer internals, TigerBeetle clients, raw PostgreSQL write clients, or secret material APIs outside the credential-ref broker.

Required hooks: validate content type, validate size, scan/quarantine, validate schema, classify/redact, map external identity, produce command proposal, record delivery attempt.

Evidence:

```text
ci://tests/integration/adapter-sdk-forbids-operational-repository-import
ci://tests/integration/adapter-sdk-produces-command-proposal-only
ci://tests/integration/adapter-sdk-no-direct-ledger-or-outbox-write
```
