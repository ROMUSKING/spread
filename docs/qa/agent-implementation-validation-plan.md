# Agent Implementation Validation Plan

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Status:** Active QA plan for agent-executed work

## Purpose

This plan defines validation for AI coding-agent execution. It does not replace product tests; it ensures that agent work remains scoped, evidence-linked, and safe.

## Required process tests

| Evidence URI | Purpose |
|---|---|
| `ci://tests/process/agent-roadmap-present` | Roadmap and AGENTS instructions exist. |
| `ci://tests/process/agent-work-orders-have-evidence` | Every active work order lists tests/evidence. |
| `ci://tests/process/agent-validation-command-present` | Repository exposes validation command. |
| `ci://tests/process/agent-pr-template-present` | PR handoff template exists. |
| `ci://tests/process/no-agent-work-order-bypasses-p0-order` | Work orders do not reorder P0 gates. |
| `ci://tests/process/no-post-mvp-plane-in-phase0-edit-path` | Post-MVP planes remain absent from ordinary edit path. |
| `ci://tests/process/post-mvp-scaffolding-feature-flagged-off` | Future-plane scaffolds default off. |
| `ci://tests/process/agent-handoff-includes-validation-output` | PR handoffs record validation output. |

## Benchmark target

```yaml
BENCH-EXEC-001:
  validate_pack_p95_s: 30
  agent_pr_required_checks_present: true
  work_order_evidence_coverage_required: true
  post_mvp_runtime_in_edit_path_allowed: false
```

## Agent QA matrix

| Work order group | Required validation |
|---|---|
| AGENT-000..001 | pack validation, manifest coverage, CI workflow. |
| AGENT-010..013 | command API, command status, ambiguity, transaction rollback. |
| AGENT-020..022 | outbox schema, polling replay, SSE handshake, retention gap. |
| AGENT-030..031 | invariant manifest, RLS, access control. |
| AGENT-040 | batch fixtures, fuzz, 10k compile budget. |
| AGENT-050 | rate limiter hot path, credential stuffing, headers. |
| AGENT-060 | vertical slice UI, ambiguous state, command status. |
| AGENT-070..071 | OTel contract, outbox performance, chaos. |
| AGENT-080 | integration staging safety, no external runtime. |
| AGENT-090 | sign-off package. |
| AGENT-100 | feature flags default off, no post-MVP runtime in edit path. |

## Nightly checks

```text
- full invariant manifest;
- all P0 integration tests;
- outbox polling benchmark smoke;
- batch partition fuzz sample;
- ID derivation parity sample;
- static scan for forbidden direct-write phrases;
- generated docs/reference drift report.
```

## v0.17.0 additional execution evidence

The following evidence extends `BENCH-EXEC-001`:

```text
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
```

The simulation suite must fail unsafe fake PRs with readable stop-condition messages. A passing bad PR is a release blocker.
