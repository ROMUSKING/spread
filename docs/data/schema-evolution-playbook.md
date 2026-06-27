---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "implementation-readiness baseline"
---

# Schema Evolution Playbook

## Purpose

Prevent schema drift across the main spec, gates, ADRs, and developer docs.

## Canonical DDL sources

| Schema family | Canonical file | Non-canonical files may do this |
|---|---|---|
| Command, outbox, heartbeat, transient rate-limit tables | `docs/data/command-outbox-retention-partitioning.md` | Link to the canonical section and describe behavior. |
| MVP numeric ledger and TigerBeetle mirror tables/indexes | `docs/data/numeric-ledger-contract.md` | Link to the canonical section and describe adapter semantics. |

No other file may contain canonical `CREATE TABLE` definitions for these schemas.

## Canonical logical domain contracts (Phase 0 spreadsheet workbooks/tables)

For Phase 0, *logical* workbook / data table contracts (column definitions, partition keys, row ID conventions, relations, basic validation rules) for domain areas such as ecommerce + warehouse operations are documented in:

- `docs/data/pilot-dataset-definition.md` (Ecommerce + Owned Warehouse Logical Workbooks subsection, UUIDs, columns, fixtures)
- Cross-referenced detailed contracts, commands, and synergy analysis in `docs/data/sme-ecommerce-domain-model-and-business-logic-spec.md`
- Extended Master Data and Product Variants logical contracts in `docs/data/sme-extended-variants-and-entities-spec.md`

These are **logical** (not physical DDL). Physical representation uses existing `current_cell_values` + `numeric_*` tables. Future physical tables must still follow the expand/contract pattern and be recorded only in the DDL canonicals above after governance updates.

Non-canonical files must link here and not duplicate the logical contracts. `validate-pack.sh` will enforce drift detection for listed canonicals.


## Migration pattern

Use expand/contract by default:

```text
1. Expand: add nullable column/table/index or compatibility path.
2. Backfill: write migration job with resumable progress marker.
3. Dual-read or dual-write only where necessary and explicitly bounded.
4. Verify: run invariant CI, projection rebuild, and benchmark deltas.
5. Switch: move readers/writers behind feature flag or ledger migration state.
6. Contract: remove deprecated path after retention/legal-hold window.
```

## Required migration record

Every schema change must add a record to the PR description or decision log:

```yaml
schema_change:
  owner: ""
  canonical_file: "repo://docs/data/..."
  tables_changed: []
  expand_contract_stage: "expand|backfill|switch|contract"
  backward_compatible: true
  rollback_path: ""
  projection_rebuild_required: false
  privacy_review_required: false
  evidence:
    - "ci://tests/..."
```

## Command/outbox constraints

- Preserve `PRIMARY KEY (tenant_id, command_id)` for active command idempotency.
- Preserve outbox high-watermark replay semantics.
- Do not change outbox retention behavior without full-refresh fallback evidence.
- Do not add raw request/response storage without privacy and retention sign-off.

## Numeric ledger constraints

- Preserve deterministic ID derivation in `docs/data/numeric-ledger-contract.md`.
- Preserve `transfer_payload_hash` conflict detection.
- Preserve projection rebuildability.
- Preserve TigerBeetle field-width compatibility.
- Preserve field-assignment policy versioning.

## Validation

`scripts/validate-pack.sh` must fail when canonical DDL is duplicated outside approved data-contract files, when required docs are missing, or when benchmark/test manifest entries drift from the SLO baseline.
