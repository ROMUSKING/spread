---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "active drift-control map"
owner: "Engineering Lead"
---

# Normative Source Map

## Purpose

Reduce duplication risk by naming the canonical source for each major contract.

| Contract | Canonical source | Other files may |
|---|---|---|
| Phase 0 execution and DoD | active spec + `docs/pack-index.md` | Link and summarize briefly. |
| Command lifecycle / transaction boundary | `docs/dev/command-lifecycle.md` | Link; do not restate pseudo-code or savepoint rules. |
| Command/outbox DDL | `docs/data/command-outbox-retention-partitioning.md` | Reference table names and behavior; do not restate full DDL. |
| Outbox polling performance | `docs/data/outbox-polling-performance-contract.md` | Link and list evidence IDs. |
| Event envelope | `docs/data/event-envelope-contract.md` | Link and mention field categories. |
| Numeric ledger contract | `docs/data/numeric-ledger-contract.md` | Link and state ledgerability rule. |
| Ledger ID derivation | `docs/data/ledger-id-derivation-reference.md` | Do not restate hash inputs or code. |
| TigerBeetle field assignment | `docs/data/tigerbeetle-field-assignment-policy.md` | Link and say hybrid model selected. |
| pgvector semantic retrieval | `docs/data/semantic-retrieval-contract.md` | Link and state derived-only retrieval. |
| Retrieval revalidation | `docs/dev/retrieval-revalidator.md` | Link and state mandatory middleware. |
| DuckDB analytics/export | `docs/data/analytics-export-contract.md` | Link and state derived-snapshot-only. |
| OTel reference examples | `docs/observability/otel-reference.yml` | Link; keep executable examples in YAML. |
| Observability | `docs/observability/phase0-observability.md` | Link and include dashboard names only. |
| Failure behavior | `docs/ops/failure-mode-catalog.md` | Link and reference FM IDs. |

## Historical artifacts

`CHANGELOG-v0.12.*` and `docs/review/critical-review-v0.12.*` are archival. They should not be listed as current implementation prerequisites except where the review response is useful background. Active implementation should follow v0.13.3 files and current gate cards.

## Maintenance rule

If a PR adds normative wording to a non-canonical file, it must either:

```text
1. move the wording into the canonical source; or
2. open an ADR changing the canonical source map; or
3. mark the wording as non-normative summary with a direct link.
```


## v0.13.3 implementation-readiness canonical owners

| Contract | Canonical document |
|---|---|
| Command transaction boundary | `docs/dev/command-lifecycle.md` |
| RetrievalRevalidator implementation and cache policy | `docs/dev/retrieval-revalidator.md` |
| OpenTelemetry reference examples | `docs/observability/phase0-observability.md`, `docs/observability/otel-reference-v0.13.3.yml` |
| TigerBeetle shadow-mode operating model | `docs/ops/tigerbeetle-shadow-mode-day-in-life.md` |
| Concrete recovery drills | `docs/ops/recovery-playbooks-v0.13.3.md` |


---

## v0.14 external integration note

External integration policies are canonical in `docs/data/external-integration-strategy-options.md` and `docs/data/external-integration-contract.md`. This document may reference those contracts but must not restate connector authority rules.


## v0.14 external integration canonical sources

| Contract | Canonical source |
|---|---|
| External-system integration strategy | `docs/data/external-integration-strategy-options.md` |
| External integration contract objects and flows | `docs/data/external-integration-contract.md` |
| External security boundary | `docs/security/integration-security-boundary.md` |
| External evidence gate | `docs/gates/P1-INTEGRATION-001-external-systems-integration-spike.md` |
| External operational runbook | `docs/ops/external-integration-runbook.md` |

Historical v0.12.x and v0.13.x changelogs/reviews are archival unless an active v0.14 document explicitly references them.

## v0.14.1 additions

| Topic | Canonical source |
|---|---|
| External integration security pipeline | `docs/security/integration-security-boundary.md` |
| Credential/service-account lifecycle | `docs/security/integration-credential-management.md` |
| External integration DDL | `docs/data/external-integration-contract.md` |
| Adapter SDK boundary | `docs/dev/external-adapter-sdk-contract.md` |
| Tiled spreadsheet workspace UI | `docs/ui/spreadsheet-tiled-workspace-strategy.md` |
| Event identity / command_event_seq | `docs/data/event-envelope-contract.md` |
