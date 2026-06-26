# CHANGELOG v0.15.2

**Date:** 2026-06-26  
**Status:** Agent handoff polish and simulation-evidence patch

## Added

- `docs/snapshot-v0.15.2.md` with START HERE banner, Mermaid authority map at top, and a five-line agent non-goals checklist.
- `docs/implementation/pr-handoff-examples.md` with concrete good and rejected PR diff examples.
- `docs/qa/agent-simulation-run-v0.15.2.md` with attached bad-PR simulation output.
- `SNAP-002`, `EXEC-009`, and `EXEC-010` invariants.
- Visible SLO targets for snapshot-first-read enforcement, agent-simulation rejection, and PR-handoff examples.

## Changed

- Promoted active spec to v0.15.2.
- README and pack-index now start with the snapshot banner.
- P0-EXEC-001 now requires attached simulation evidence and PR handoff examples.
- Validation checks now require v0.15.2 snapshot, PR examples, simulation run output, and SLO targets.

## Unchanged

- Phase 0 product gate order remains locked.
- Post-MVP runtimes remain excluded from the ordinary Phase 0 edit path.
- Command/outbox authority remains the mutation boundary.
