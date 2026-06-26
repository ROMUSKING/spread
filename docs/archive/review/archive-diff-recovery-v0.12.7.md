---
version: "0.12.7"
last-reviewed: "2026-06-26"
status: "archive recovery audit"
---

# Archive Diff and Recovery Audit v0.12.7

## Purpose

Record the check against previous generated archives and capture content that should not be lost while the pack continues to consolidate.

## Archives checked

```text
spreadsheet_native_erp_v0_12_research_gate_pack(1).zip
spreadsheet_native_erp_v0_12_1_research_gate_pack.zip
spreadsheet_native_erp_v0_12_2_refined_pack.zip
spreadsheet_native_erp_v0_12_3_kickoff_ready_pack.zip
spreadsheet_native_erp_v0_12_4_ledger_ready_pack.zip
spreadsheet_native_erp_v0_12_4_tigerbeetle_ready_pack.zip
spreadsheet_native_erp_v0_12_5_*pack.zip
spreadsheet_native_erp_v0_12_6_*pack.zip
```

## Recovered or restored content

| Previous content | Status in v0.12.7 | Destination |
|---|---|---|
| Legacy `docs/runbooks/outbox-wakeup.md` link target | Restored as compatibility pointer. | `docs/runbooks/outbox-wakeup.md` |
| Legacy `docs/runbooks/unknown-command-outcome.md` link target | Restored as compatibility pointer. | `docs/runbooks/unknown-command-outcome.md` |
| Legacy `docs/benchmarks/phase0-benchmark-plan.md` link target | Restored as compatibility pointer. | `docs/benchmarks/phase0-benchmark-plan.md` |
| v0.12.4 standalone ledgerability classification table | Restored and expanded as standalone data doc. | `docs/data/ledgerability-classification.md` |
| v0.12.4 ledger sub-pack navigation | Restored as compatibility sub-pack index. | `docs/ledger/README.md` |
| v0.12.4 ledger migration diagrams | Restored as compatibility diagram file. | `docs/diagrams/ledger-plane-and-migration.md` |
| v0.12.4 TigerBeetle cutover/runbook prerequisites | Restored as concrete runbook stubs. | `docs/ops/tigerbeetle-*.md` |
| v0.12.6 review response file from alternate archive | Restored. | `docs/review/review-response-v0.12.6.md` |

## Intentionally not restored

| Previous content | Reason |
|---|---|
| Older versioned spec filenames | Superseded by the active v0.12.7 spec; keeping old specs in the active pack would create normative ambiguity. |
| Duplicate DDL in spec/gates/dev docs | Removed by design; canonical DDL is centralized in `docs/data/*`. |
| Earlier `docs/ledger/*` full model files | Replaced by canonical `docs/data/*` documents plus compatibility pointers. |

## Validation rule added

The validator now checks for restored compatibility files and fails if canonical `CREATE TABLE` definitions appear outside the approved data-contract files.
