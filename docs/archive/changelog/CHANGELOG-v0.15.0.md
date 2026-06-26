# CHANGELOG v0.15.0

**Date:** 2026-06-26  
**Status:** AI coding-agent implementation roadmap baseline

## Added

- Root `AGENTS.md` with non-negotiable architecture boundaries for coding agents.
- `docs/implementation/ai-coding-agent-roadmap.md` with milestone sequence, dependency DAG, agent classes, stop conditions, and validation commands.
- `docs/implementation/phase0-agent-work-orders.md` with Phase 0 work orders for command, outbox, invariants, batch, rate limiting, client vertical slice, observability, integration preparedness, and acceptance.
- `docs/implementation/agent-operating-model.md` with agent claim, handoff, review, and escalation protocol.
- `docs/implementation/agent-pr-validation-playbook.md` with PR body template, validation commands, and reviewer checklist.
- `docs/qa/agent-implementation-validation-plan.md` with process evidence and `BENCH-EXEC-001`.
- `docs/gates/P0-EXEC-001-ai-agent-implementation-readiness.md` as an execution-governance gate for agent-authored PRs.
- `docs/diagrams/ai-agent-implementation-roadmap.md` with roadmap and PR lifecycle diagrams.
- Invariants EXEC-001 through EXEC-006.

## Changed

- Active spec promoted to v0.15.0 and archived v0.14.3 spec.
- README and pack index now point to agent execution docs first.
- Test manifest, invariant manifest, SLO baseline, and validation script now target v0.15.0.

## Preserved

- Phase 0 remains command-first, polling-first, invariant-CI-first.
- Product gate order remains locked.
- TigerBeetle, pgvector, DuckDB, broker/CDC fan-out, full UI tiling, and connector runtime remain post-MVP/evidence-gated.
