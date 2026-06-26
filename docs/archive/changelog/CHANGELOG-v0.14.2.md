# CHANGELOG v0.14.2

**Date:** 2026-06-26  
**Status:** Review closure / implementation-readiness patch

## Added

- Active v0.14.2 spec with review-closure summary for integration security, UI scope, credential depth, and validation cleanup.
- Integration staging -> command proposal -> command handler sequence and eligibility gates in `docs/dev/command-lifecycle.md`.
- KMS/envelope-encryption, secret-scanning, rotation-overlap, and revocation-propagation requirements in `docs/security/integration-credential-management.md`.
- Negative integration fixture: `tests/fixtures/integration/pilot-v1-small-import-negative.json`.
- Integration-specific threat model additions and observability thresholds.

## Changed

- `P1-UX-001` is explicitly post-vertical-slice.
- Required docs in `tests/manifest.yml` are deduplicated.
- Validation is promoted to v0.14.2 and rejects duplicate requiredDocs, stale active spec files, missing negative integration fixture, and missing credential-depth evidence.

## Preserved

- Phase 0 remains command-first, polling-first, invariant-CI-first.
- External systems remain non-authoritative by default.
- TigerBeetle, pgvector, DuckDB, broker/CDC fan-out, UI tiling, and connector runtime remain post-MVP/evidence-gated.
