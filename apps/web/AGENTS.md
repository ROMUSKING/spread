# Scoped Agent Instructions

Web package. Spreadsheet UI shell with preview tiling scaffolding for Phase 0. UI edits call command_api and never write operational state directly. Production tiling runtime waits for P1-UX-001 after AGENT-090 green.

First read: `docs/snapshot-v0.18.0.md` from repository root, then root `AGENTS.md`.

## UI work order sequence (v0.18.0)

```text
AGENT-060  vertical slice — one safe cell e2e green
AGENT-061  column metadata rendering
AGENT-062  cross-workbook live refresh
AGENT-063  flattened order grouping
AGENT-064  react-window + Glide POC (ADR-0028)
AGENT-065  packages/ui extraction + page.tsx hooks
```

## Phase 0 UI testing policy

- Package smoke tests live in `apps/web/test/smoke.test.mjs` and must keep the exact script: `node --test test/smoke.test.mjs` (web may use `node --experimental-strip-types` when importing `.ts` helpers).
- Prefer unit tests for pure helpers in `src/lib/` (`preferencesUtils.ts`, `gridUtils.ts`, `workbookUtils.ts`, `commandUtils.ts`) rather than duplicating logic in tests.
- Component render/integration tests are post-MVP; smoke tests cover file existence, wiring checks, and pure helper contracts.
- Do not weaken smoke or validation scripts to pass UI changes.