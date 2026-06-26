# CHANGELOG v0.15.1

**Date:** 2026-06-26  
**Status:** Delivery-velocity review closure

## Summary

v0.15.1 addresses the v0.15.0 critical review by reducing cognitive overhead and adding concrete implementation scaffolding without widening MVP runtime scope.

## Added

```text
- docs/snapshot-v0.15.1.md one-page architecture snapshot.
- SNAP-001 invariant and P0-EXEC-001 wiring.
- docs/post-mvp/post-mvp-planes-vnext.md for detailed post-MVP plane planning outside the active spec.
- docs/tech-stack-decisions.md provisional monorepo and stack snapshot.
- docs/skeletons/ golden-master skeletons for command, outbox, numeric ledger port, and revalidator.
- docs/process/validation-waiver-policy.md and validate-pack --waiver mode.
- docs/qa/agent-simulation-test.md for fake bad PR rejection tests.
- docs/pack-health-dashboard.md.
- UI-008 invariant blocking tile/transposed mutation bypass before P1-UX-001.
```

## Changed

```text
- Promoted active spec to v0.15.1.
- Updated README, pack-index, AGENTS.md, roadmap, work orders, manifest, SLOs, invariants, and validation.
- SLO baseline now exposes the Phase 0 and agent-execution subset directly.
- P0-EXEC-001 now requires the snapshot, skeletons, safe waiver policy, and agent simulation tests.
- Agent PR playbook now includes good and bad handoff examples.
```

## Unchanged

```text
- Phase 0 product gate order.
- Command/outbox mutation authority.
- Polling-first live update default.
- No post-MVP runtimes in the ordinary Phase 0 edit path.
- TigerBeetle, pgvector, DuckDB, integration, broker/CDC, and full tiled UI remain evidence-gated post-MVP planes.
```
