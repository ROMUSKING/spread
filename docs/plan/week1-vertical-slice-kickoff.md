---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "kickoff-ready baseline"
---

# Week-1 Vertical Slice Kickoff Plan

## Goal

By the end of Week 1, the team should have a thin safe-cell edit path that proves command identity, durable outbox polling, SSE subscription recovery, and privacy-safe observability on the pilot dataset.

## Kickoff agenda

| Segment | Topic | Owner | Output |
|---:|---|---|---|
| 0-15 min | Phase 0 non-goals and minimal slice | Engineering Lead | Confirm no broad grid work before slice. |
| 15-35 min | Command contract and privacy boundary | API/Client + Security | Confirm command schema and redaction rules. |
| 35-55 min | Outbox polling/SSE handshake | Platform/SRE | Confirm schema, initial snapshot, replay, full refresh. |
| 55-70 min | Pilot dataset and benchmark targets | QA/SRE | Confirm `pilot-v1-small` and `pilot-v1-10k`. |
| 70-85 min | Ticket ownership and evidence URIs | All owners | Assign tickets below. |
| 85-90 min | Waiver/decision log procedure | Engineering Lead | Confirm no silent deviations. |

## Week-1 tickets

| Ticket | Title | Owner | Depends on | Done when |
|---|---|---|---|---|
| W1-CMD-01 | Create command status API skeleton and OpenAPI contract tests | API/Client | None | `GET /commands/{id}` supports terminal, pending, not-found, and ambiguity responses. |
| W1-CMD-02 | Implement command_log uniqueness and duplicate in-flight behavior | API/Client | W1-CMD-01 | Same command/hash returns pending or original result; different hash returns conflict. |
| W1-CMD-03 | Add privacy-safe command response storage | API/Client + Security | W1-CMD-02 | Raw request bodies are absent; redacted/encrypted response policy is enforced. |
| W1-DATA-01 | Create current/audit/domain/outbox transaction fixture | Backend | W1-CMD-02 | One safe cell edit writes all required records atomically. |
| W1-LIVE-01 | Create explicit outbox_events schema and indexes | Platform/SRE | W1-DATA-01 | Schema matches `docs/data/command-outbox-retention-partitioning.md`. |
| W1-LIVE-02 | Implement polling reader high-watermark loop | Platform/SRE | W1-LIVE-01 | Replay test handles non-gapless outbox IDs. |
| W1-LIVE-03 | Implement SSE initial snapshot and replay handshake | Platform/SRE + Frontend | W1-LIVE-02 | Late subscribers do not miss events and retention gaps force refresh. |
| W1-OBS-01 | Wire trace/correlation propagation and minimum metrics | SRE | W1-CMD-02, W1-LIVE-02 | Trace spans connect command -> audit/domain/outbox -> SSE. |
| W1-QA-01 | Build vertical-slice test harness using pilot dataset | QA | All above | Acceptance checklist evidence is generated. |
| W1-GOV-01 | Enable validation workflow in CI | Engineering Lead | None | `.github/workflows/validate-pack.yml` runs on PRs. |
| W1-LEDGER-01 | Scaffold `NumericLedgerPort` and deterministic ID helpers | Domain Ledger Owner | W1-CMD-02 | Financial/stock commands have a ledger-shaped path before broad MVP work. |

## Standup questions

1. Did any work bypass command identity or outbox polling?
2. Did any implementation store raw request/response bodies?
3. Did any subscriber path apply deltas before initial snapshot?
4. Did any owner need a waiver or decision-log entry?
5. Did any conserved numeric movement bypass `NumericLedgerPort`?
6. Did validation still return health score 100/100?
