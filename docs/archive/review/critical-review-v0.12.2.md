---
version: "0.12.2"
last-reviewed: "2026-06-26"
status: "refined baseline"
---

# Critical Review and Applied Refinements - v0.12.2

## Summary

The externally integrated v0.12.1 pack moved in the right direction but remained uneven. It carried several high-value concepts from the review, yet some files were placeholders, the main spec still identified as v0.12, and several operational contracts were still under-specified.

## Findings fixed in this archive

| Finding | Severity | Refinement applied |
|---|---:|---|
| `docs/pack-index.md` was placeholder text rather than a single source of truth. | High | Replaced with full playbook, links, locked order, RACI, estimates, vertical slice, and maintenance rules. |
| Main spec still used v0.12 identity while archive claimed v0.12.1. | High | Promoted normative spec to v0.12.2 and renamed spec file to match. |
| ADR-0014 was referenced but absent in the external pack. | High | Included ADR-0014 and added ADR-0017 for command-log privacy/trace context. |
| `docs/dev` and `docs/ops` files referenced by the spec were absent or inconsistent with legacy runbook paths. | Medium | Added/kept full dev, ops, QA, and runbook docs; pack index now points to canonical ops paths. |
| SLO baseline had insufficient coverage. | High | Expanded SLOs with command pending, ambiguity rate, SSE initial sync, trace propagation, and privacy rules. |
| `trace_id UUID` would not fit OpenTelemetry trace IDs cleanly. | Medium | Changed trace ID guidance to text/opaque trace context. |
| `response_body` in `command_log` could retain sensitive data. | High | Replaced with redacted response body or encrypted short-retention response reference. |
| Duplicate in-flight command execution was under-specified. | High | Added first-writer execution pattern and `COMMAND_PENDING` behavior. |
| Demand-filtered polling could confuse late subscribers. | High | Added SSE initial snapshot/resume/sync-required state machine and tests. |
| Retention, vacuum, and partition strategy were scattered. | Medium | Added centralized data-retention and partitioning doc. |
| Validation script was too weak for drift prevention. | Medium | Rebuilt validation to check required files, versions, placeholders, invariants, SLOs, duplicate docs, and spec path consistency. |

## Remaining highest-risk implementation areas

1. **Transactional-batch partitioning** remains the highest correctness risk. Keep it narrow, policy-based, and fuzzed.
2. **Command recovery** must be implemented first; no editable cell PR should merge before P0-CMD-001 evidence exists.
3. **Outbox/SSE replay semantics** must be tested with late subscribers, retention gaps, and multi-instance deployments.
4. **Privacy/compliance boundaries** must be decided before importing or retaining regulated tenant payloads.
5. **Formula workers** should stay TypeScript/resident-graph first until benchmark evidence justifies another runtime.

## Release posture

This v0.12.2 pack is suitable as the Phase 0 baseline for engineering kickoff, provided the validation script passes and owners accept the RACI in `docs/pack-index.md`.
