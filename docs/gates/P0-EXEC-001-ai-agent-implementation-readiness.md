# P0-EXEC-001: AI Agent Implementation Readiness

**Version:** 0.17.0  
**Status:** Execution governance gate; does not alter product P0 order  
**Owner:** Engineering Lead + QA Owner  
**Waiver:** Not allowed for agent-authored PRs

## Goal

Ensure AI coding agents can execute Phase 0 work orders without weakening command/outbox/security boundaries or introducing post-MVP runtime dependencies into the MVP edit path.

## Scope

This is a process and implementation-readiness gate. It must be green before broad agent-authored implementation PRs are merged.

It does **not** supersede:

```text
P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001
```

## Bootstrap completion status

P0-EXEC-001 is green for the runnable bootstrap baseline once `docs/qa/bootstrap-completion-evidence-v0.17.0.md` links validation, smoke typecheck, package smoke tests, ZIP integrity, and agent simulation evidence.

## Requirements

1. `AGENTS.md` exists and states non-negotiable architecture boundaries.
2. `docs/implementation/ai-coding-agent-roadmap.md` defines milestones, dependency DAG, and agent classes.
3. `docs/implementation/phase0-agent-work-orders.md` defines work orders with dependencies, allowed paths, tests, acceptance criteria, and stop conditions.
4. `docs/implementation/agent-operating-model.md` defines claim, handoff, review, and escalation protocols.
5. `docs/implementation/agent-pr-validation-playbook.md` defines required PR body and validation commands.
6. `docs/qa/agent-implementation-validation-plan.md` maps agent process tests to evidence URIs.
7. Agent work orders must not reorder P0 gates.
8. Agent work orders must not admit TigerBeetle, pgvector, DuckDB, broker/CDC, connector runtime, full UI tiling, or external APIs into the Phase 0 edit path.
9. Every agent PR must run `scripts/validate-pack.sh` before handoff.
10. Reviewer checklist must reject command bypass, outbox bypass, secret leakage, direct external writes, direct TigerBeetle writes, and unrevalidated derived-plane output.
11. `SNAP-001` requires `docs/snapshot-v0.17.0.md` to exist, is referenced by README and pack-index, and is the first-read artifact for agents and humans. `SNAP-002` requires README and pack-index to begin with a START HERE snapshot entrypoint.
12. Code work orders that touch covered domains must start from `docs/skeletons/` reference skeletons.
13. Validation waiver mode is documented and limited to non-release-blocking warnings with a decision-waiver-log entry.
14. `docs/qa/agent-simulation-test.md` defines bad-agent-PR rejection tests.
15. UI work before P1-UX-001 must not introduce tile/transposed mutation paths outside `command_api`.
16. `docs/implementation/pr-handoff-examples.md` must contain concrete good and rejected PR diff examples.
17. `docs/qa/agent-simulation-run-v0.17.0.md` must attach simulation output for bad-PR rejection behavior.
18. `scripts/smoke-package-tests.sh` must pass dependency-free package smoke tests for every workspace.
19. `docs/release/vertical-slice-release-note-template.md` must exist before first feature PR handoff.


## Evidence required

```text
ci://tests/process/agent-roadmap-present
ci://tests/process/agent-work-orders-have-evidence
ci://tests/process/agent-validation-command-present
ci://tests/process/agent-pr-template-present
ci://tests/process/no-agent-work-order-bypasses-p0-order
ci://tests/process/no-post-mvp-plane-in-phase0-edit-path
ci://tests/process/post-mvp-scaffolding-feature-flagged-off
ci://tests/process/agent-handoff-includes-validation-output
ci://benchmarks/BENCH-EXEC-001

ci://tests/process/snapshot-first-read-present
ci://tests/process/skeletons-present-for-core-boundaries
ci://tests/process/validation-waiver-requires-log-entry
ci://tests/process/agent-simulation-direct-write-rejected
ci://tests/process/agent-simulation-post-mvp-runtime-rejected
ci://tests/process/agent-simulation-command-without-outbox-rejected
ci://tests/process/agent-simulation-revalidator-bypass-rejected
ci://tests/process/agent-simulation-tile-command-bypass-rejected
ci://tests/process/agent-simulation-ddl-centralization-rejected
ci://tests/process/agent-simulation-waiver-requires-log-entry
ci://tests/ui/no-tile-transpose-mutation-before-p1-ux
ci://tests/docs/pack-snapshot-current

ci://tests/process/snapshot-start-here-banner-in-readme-and-index
ci://tests/process/agent-pr-handoff-examples-present
ci://tests/process/agent-simulation-output-attached
ci://benchmarks/BENCH-EXEC-002
ci://benchmarks/BENCH-SNAP-001
ci://tests/process/bootstrap-completion-evidence-attached
ci://tests/process/package-smoke-tests-pass
ci://benchmarks/BENCH-REPO-003
ci://benchmarks/BENCH-BOOTSTRAP-001

```

## Failure behavior

If this gate fails, agent-authored PRs may only modify documentation or tests needed to make the gate pass. Feature implementation must pause.
