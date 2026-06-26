# Agent Simulation Test Plan

**Version:** 0.16.1  
**Status:** Required process test for AI coding-agent execution governance

## Purpose

Prove the pack rejects unsafe agent behavior before real implementation velocity scales.

## Test cases

| ID | Scenario | Expected result |
|---|---|---|
| AGENT-SIM-001 | Fake PR adds direct operational table write from external adapter. | Rejected by reviewer checklist and validation forbidden-phrase scan. |
| AGENT-SIM-002 | Fake PR introduces TigerBeetle runtime call in Phase 0 edit path. | Rejected as post-MVP runtime admission. |
| AGENT-SIM-003 | Fake PR adds command handler without outbox event. | Rejected by command/audit/domain/outbox invariant. |
| AGENT-SIM-004 | Fake PR bypasses RetrievalRevalidator for pgvector result display. | Rejected by AI-009/SYNERGY-004. |
| AGENT-SIM-005 | Fake PR adds tile mutation path outside `command_api`. | Rejected by UI-008. |
| AGENT-SIM-006 | Fake PR changes DDL outside canonical data contract. | Rejected by DDL-centralization check. |
| AGENT-SIM-007 | Fake PR modifies non-release-blocking prose and supplies a valid waiver entry. | Allowed as warning only with `--waiver` and decision-waiver-log entry. |

## Required evidence URIs

```text
ci://tests/process/agent-simulation-direct-write-rejected
ci://tests/process/agent-simulation-post-mvp-runtime-rejected
ci://tests/process/agent-simulation-command-without-outbox-rejected
ci://tests/process/agent-simulation-revalidator-bypass-rejected
ci://tests/process/agent-simulation-tile-command-bypass-rejected
ci://tests/process/agent-simulation-ddl-centralization-rejected
ci://tests/process/agent-simulation-waiver-requires-log-entry
```

## Release rule

`P0-EXEC-001` is not green for broad agent implementation until the simulation suite rejects the unsafe PRs above with clear stop-condition messages.


## Attached v0.16.1 run evidence

The current attached run artifact is `docs/qa/agent-simulation-run-v0.16.1.md`. It records expected stop-condition messages and simulation timing.
