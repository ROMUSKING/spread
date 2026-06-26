# CHANGELOG v0.16.0

**Date:** 2026-06-26  
**Status:** Runnable project bootstrap baseline

## Added

- `docs/snapshot-v0.16.0.md` with repository tree visual and required smoke commands.
- `scripts/smoke-typecheck.sh` to run a lightweight TypeScript smoke typecheck over the Phase 0 stubs.
- `tsconfig.smoke.json` for repository-wide no-emit typechecking without admitting runtime dependencies.
- `docs/qa/repository-smoke-test-v0.16.0.md` with the smoke-test evidence contract.
- `SNAP-003`, `EXEC-013`, `EXEC-014`, and `DOC-002` invariants.

## Changed

- Promoted active spec, manifest, invariants, SLOs, README, pack index, package metadata, and validation to v0.16.0.
- Root `package.json` now exposes `smoke`, `smoke:typecheck`, and `validate:all` scripts.
- CI workflow now runs pack validation and smoke typecheck.
- Snapshot is now the repository-shape and smoke-test entrypoint.

## Cleaned

- Removed generated `dist/`, source `.d.ts`, and `*.tsbuildinfo` files from the source archive.
- Validation now rejects generated build artifacts and stale active v0.15.x references.
- `docs/skeletons/` remains a compatibility pointer and contains no TypeScript skeletons.
