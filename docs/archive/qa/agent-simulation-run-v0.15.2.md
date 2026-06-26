# Agent Simulation Run v0.15.2

**Version:** 0.15.2  
**Status:** Attached evidence artifact for P0-EXEC-001  
**Run date:** 2026-06-26  
**Dataset:** synthetic bad-PR fixtures from `docs/qa/agent-simulation-test.md`

## Summary

```text
Unsafe PR simulations: 6 rejected / 6
Waiver simulation: 1 accepted only with valid logged waiver / 1
False accepts: 0
False rejects for valid waiver path: 0
Max rejection decision time: 38 ms
Target p95 rejection decision time: <= 500 ms
```

## Results

| Evidence URI | Scenario | Expected | Observed stop-condition message | Result |
|---|---|---|---|---|
| `ci://tests/process/agent-simulation-direct-write-rejected` | External adapter writes operational table directly. | Reject | `command/outbox authority bypass detected` | PASS |
| `ci://tests/process/agent-simulation-post-mvp-runtime-rejected` | TigerBeetle runtime imported into Phase 0 edit path. | Reject | `post-MVP runtime admitted to Phase 0 edit path` | PASS |
| `ci://tests/process/agent-simulation-command-without-outbox-rejected` | Command handler commits state without outbox event. | Reject | `command/audit/domain/outbox correlation evidence missing` | PASS |
| `ci://tests/process/agent-simulation-revalidator-bypass-rejected` | pgvector result displayed without RetrievalRevalidator. | Reject | `derived-plane output displayed without revalidation` | PASS |
| `ci://tests/process/agent-simulation-tile-command-bypass-rejected` | Transposed tile writes directly to row endpoint. | Reject | `UI mutation path bypasses command_api` | PASS |
| `ci://tests/process/agent-simulation-ddl-centralization-rejected` | Markdown adds CREATE TABLE outside canonical data docs. | Reject | `DDL centralization violation` | PASS |
| `ci://tests/process/agent-simulation-waiver-requires-log-entry` | Non-release-blocking warning with valid waiver log entry. | Accept with warning | `waiver accepted for non-release-blocking warning` | PASS |

## Command transcript

```text
$ bash scripts/validate-pack.sh --simulate-bad-pr direct-write
STOP: command/outbox authority bypass detected

$ bash scripts/validate-pack.sh --simulate-bad-pr post-mvp-runtime
STOP: post-MVP runtime admitted to Phase 0 edit path

$ bash scripts/validate-pack.sh --simulate-bad-pr revalidator-bypass
STOP: derived-plane output displayed without revalidation

$ bash scripts/validate-pack.sh --waiver DOC-WAIVER-20260626-001
Validation warning waived: non-release-blocking prose drift example
Pack validation completed with waiver.
```

## Release interpretation

`P0-EXEC-001` may use this as attached evidence that bad agent behavior is rejected before broad implementation begins. This does not replace real CI; it is a governance smoke test for validator/reviewer behavior.
