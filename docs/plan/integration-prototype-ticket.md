---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "first P1-INTEGRATION-001 implementation ticket"
---

# Synthetic Integration Prototype Ticket

Build one internal synthetic webhook/import path: receive payload, authenticate connection, rate-limit, content-type/size check, malware scan stub, schema validation, classification, staging, command proposal, and command handler dry run.

Acceptance: valid payload creates exactly one proposal; duplicates are idempotent; same key different payload conflicts; quarantine/schema/size/content-type/revoked credential/scope failures do not create command proposals.
