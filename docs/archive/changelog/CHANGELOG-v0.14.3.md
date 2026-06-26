# CHANGELOG v0.14.3

**Date:** 2026-06-26  
**Status:** Final-promotion review closure / implementation-readiness cleanup

## Added

- Active v0.14.3 specification and review-closure summary.
- Concise integration staging -> validation gates -> command proposal -> command-handler sequence in `docs/dev/command-lifecycle.md`.
- Tenant-scoped DEK + KMS master-key envelope-encryption implementation profile in `docs/security/integration-credential-management.md`.
- Integration observability closure examples for staging, scan, dead-letter, outbound delivery, and credential revocation.
- Negative fixture for revoked credential + schema mismatch: `tests/fixtures/integration/pilot-v1-revoked-credential-schema-mismatch.json`.

## Changed

- Active README, pack index, SLO manifest, invariant manifest, test manifest, validation script, and affected security/dev docs now target v0.14.3.
- P1-UX-001 remains explicitly post-vertical-slice.
- Validation now checks the v0.14.3 active spec, negative combo fixture, envelope-encryption profile, and active-doc version consistency.

## Preserved

- Phase 0 remains command-first, polling-first, invariant-CI-first.
- External systems remain non-authoritative by default.
- TigerBeetle, pgvector, DuckDB, broker/CDC fan-out, full UI tiling, and connector runtime remain post-MVP/evidence-gated.
