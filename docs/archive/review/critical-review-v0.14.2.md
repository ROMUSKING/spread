---
version: "0.14.2"
last-reviewed: "2026-06-26"
status: "review closure"
---

# Critical Review Closure v0.14.2

This patch addresses the v0.14.1 review findings:

1. Main spec promoted to v0.14.2 and synchronized with security/UI closure content.
2. `tests/manifest.yml` requiredDocs deduplicated and validation strengthened.
3. Command lifecycle now documents integration staging -> command proposal -> command handler.
4. Credential management adds KMS/envelope encryption, rotation overlap, revocation propagation, and secret-scanning evidence.
5. P1-UX-001 is explicitly post-vertical-slice.
6. Threat model adds integration-specific and marketplace supply-chain threats.
7. Observability includes integration metrics, thresholds, and trace attributes.
8. Negative integration fixture added for quarantine/dead-letter tests.
