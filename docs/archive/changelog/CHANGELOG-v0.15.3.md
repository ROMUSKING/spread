# CHANGELOG v0.15.3

**Date:** 2026-06-26  
**Status:** Project structure bootstrap patch

## Added

- Root monorepo files: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.env.example`, `.gitignore`.
- Implementation stubs under `apps/api`, `apps/web`, and `packages/*`.
- Scoped agent instruction files under `apps/`, `packages/`, `docs/`, and `tests/`.
- AI tool instruction pointers for Copilot, Cursor, Claude, and Windsurf.
- `docs/implementation/project-directory-structure.md`.
- `docs/implementation/code-stub-index.md`.
- `docs/README.md`.
- `EXEC-011`, `EXEC-012`, and `DOC-001` invariants.

## Changed

- Active snapshot promoted to `docs/snapshot-v0.15.3.md`.
- Active spec promoted to v0.15.3.
- Code skeletons moved; golden-master code skeletons moved from `docs/skeletons/*.ts` into implementation paths.
- Historical changelogs and release artifacts moved under `docs/archive/`.
- Validation now checks repository structure, source stubs, agent instruction files, and project hygiene.

## Unchanged

- Phase 0 product gate order.
- Command/outbox authority model.
- Post-MVP runtime exclusion from ordinary edit path.
