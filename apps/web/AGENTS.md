# Scoped Agent Instructions

Web package. Minimal grid/detail UI only for Phase 0. UI edits call command_api and never write operational state directly. Full tiling waits for P1-UX-001.

First read: `docs/snapshot-v0.16.1.md` from repository root, then root `AGENTS.md`.

## Phase 0 UI testing policy

- Package smoke tests live in `apps/web/test/smoke.test.mjs` and must keep the exact script: `node --test test/smoke.test.mjs` (web may use `node --experimental-strip-types` when importing `.ts` helpers).
- Prefer unit tests for pure helpers in `src/lib/` (`preferencesUtils.ts`, `gridUtils.ts`, `workbookUtils.ts`, `commandUtils.ts`) rather than duplicating logic in tests.
- Component render/integration tests are post-MVP; smoke tests cover file existence, wiring checks, and pure helper contracts.
- Do not weaken smoke or validation scripts to pass UI changes.