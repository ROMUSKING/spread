# Spreadsheet-Native ERP Technical Specification v0.16.1

**Date:** 2026-06-26  
**Status:** Phase 0 runnable project bootstrap completion baseline  
**Supersedes:** prior project-structure bootstrap baseline  
**Version note:** This is **v0.16.1**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, security, QA, SRE, product, and AI coding agents.

## 1. Executive Summary

v0.16.1 marks the runnable bootstrap as complete and adds the final delivery-polish layer: robust smoke tooling, runnable package smoke tests, bootstrap-completion evidence, and the next Phase 0 implementation assignment path. The product scope does not widen: Phase 0 still starts with command identity, durable outbox polling, security invariant CI, transactional-batch partition validation, hot-path rate limiting, and the safe-cell-edit vertical slice.

The v0.16.1 changes are operational:

```text
- active docs and repository metadata are promoted to v0.16.1;
- the first-read snapshot includes a repository tree visual;
- generated `dist/`, generated `.d.ts`, and `*.tsbuildinfo` files are excluded from the source pack; hand-written ambient declaration shims may remain under source;
- `tsconfig.smoke.json` and `scripts/smoke-typecheck.sh` prove the TypeScript stubs are coherent;
- CI and local bootstrap checks run the smoke typecheck; validation rejects stale active prior-version references;
- validation enforces the absence of duplicate docs/skeleton TypeScript files.
```

## 2. Non-Negotiable Phase 0 Boundary

```text
All mutations go through command_api.
Live updates use durable outbox polling first.
Security invariants are executable and release-blocking.
Post-MVP planes remain feature-flagged off in the ordinary edit path.
Agents may not weaken validation or smoke tests to merge faster.
```

## 3. Runnable Bootstrap Additions

| Area | Prior state | v0.16.1 refinement |
|---|---|---|
| Repository scaffold | apps/packages/stubs existed. | Add smoke typecheck script and validation wiring. |
| Snapshot | first-read snapshot existed. | Add repository tree visual and required smoke commands. |
| Skeletons | implementation stubs lived in apps/packages. | Validation confirms no duplicate TypeScript skeleton files under docs/skeletons. |
| Package scripts | workspace scripts existed. | Root typecheck uses `tsconfig.smoke.json` for bootstrap verification. |
| Generated artifacts | Some build artifacts could appear in local working trees. | Source archive excludes generated `dist/`, generated `.d.ts`, and `*.tsbuildinfo`; hand-written ambient declaration shims may remain under source when required for smoke typecheck. |
| Stale refs | validator caught some old paths. | Validation rejects stale prior-version active references in live entrypoints. |

## 4. Active Repository Shape

```text
apps/api      command API, outbox polling, SSE, integration staging stubs
apps/web      minimal spreadsheet UI shell
packages/*    domain, db, contracts, config, observability, testkit, ui
docs/         active documentation plus archive
invariants/   executable invariant manifest and SQL checks
tests/        manifest and fixtures
scripts/      validation and smoke-test utilities
```

## 5. Required Bootstrap Checks

Every PR that modifies implementation-critical files must run:

```bash
bash scripts/validate-pack.sh
bash scripts/smoke-typecheck.sh
bash scripts/smoke-package-tests.sh
```

The smoke typecheck is intentionally lightweight. It proves that the TypeScript stubs are syntactically and semantically coherent without admitting any post-MVP runtime dependency.

## 6. Active Canonical Files

| Area | Path |
|---|---|
| First-read snapshot | `docs/snapshot-v0.16.1.md` |
| Agent instructions | `AGENTS.md` |
| Project structure | `docs/implementation/project-directory-structure.md` |
| Stub index | `docs/implementation/code-stub-index.md` |
| Smoke typecheck | `scripts/smoke-typecheck.sh` |
| Package smoke tests | `scripts/smoke-package-tests.sh` |
| Test manifest | `tests/manifest.yml` |
| Invariants | `invariants/security-invariants.yml` |
| SLO baseline | `docs/slo-baseline.yml` |

## 7. Final v0.16.1 Recommendation

Proceed with Phase 0 implementation using the active work-order catalog. The bootstrap is now structurally validated and smoke-typechecked. The first real implementation sequence remains:

```text
AGENT-000 -> AGENT-001 -> AGENT-010 -> AGENT-011 -> AGENT-012 -> AGENT-020 -> AGENT-021 -> AGENT-022 -> AGENT-090
```

Do not admit TigerBeetle, pgvector, DuckDB, broker/CDC, full tiled UI, or external connector runtime into the ordinary edit path until the relevant post-MVP evidence gates pass.


## 8. v0.16.1 Review Closure

v0.16.1 addresses the final bootstrap review by adding a repository tree to the snapshot, requiring dependency-light repository smoke checks, adding TypeScript smoke typechecking, removing generated artifacts from the source archive, enforcing duplicate-skeleton cleanup, and sweeping stale active references.

The release does not widen Phase 0 runtime scope. Post-MVP systems remain documented and feature-flagged off until their evidence gates pass.


## 9. v0.16.1 Bootstrap Completion Closure

v0.16.1 addresses the runnable-bootstrap review without widening Phase 0 scope. The closure adds:

```text
- a Bootstrap achieved note in the first-read snapshot and pack index;
- robust smoke-typecheck resolution using local TypeScript first, pnpm exec when available, then global tsc;
- dependency-free package smoke tests for apps/api, apps/web, and packages/*;
- a bootstrap-completion evidence document that records validation, typecheck, package tests, and agent-simulation evidence;
- explicit next work-order assignments for AGENT-000 through AGENT-012;
- a vertical-slice release-note template for the future v0.17 safe-cell-edit milestone.
```

The release keeps TigerBeetle, pgvector, DuckDB, broker/CDC, full tiled UI, and external connector runtime outside the ordinary Phase 0 edit path.
