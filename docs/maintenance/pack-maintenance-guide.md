---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "active maintenance guide"
owner: "Engineering Lead"
---

# Pack Maintenance Guide

## Purpose

Keep the documentation pack useful during implementation without reintroducing drift. This guide is the operational companion to `docs/maintenance/normative-source-map.md`.

## Change rules

| Change type | Required action |
|---|---|
| New schema or DDL | Add it only to the canonical data-contract file named in the source map. Other docs link to it. |
| New SLO or benchmark | Add to `docs/slo-baseline.yml`, `tests/manifest.yml`, and the relevant gate card. |
| New invariant | Add to `invariants/security-invariants.yml` and map to an executable evidence URI. |
| New failure mode | Add or update `docs/ops/failure-mode-catalog.md` and the relevant runbook. |
| New post-MVP plane behavior | Add an ADR and a P1 evidence gate before implementation. |
| New summary in README/spec | Keep it short and link to the canonical file. Do not duplicate full algorithms or schemas. |

## Minimal PR checklist

```text
1. Did the change touch a canonical source listed in normative-source-map?
2. Did every gate/SLO/invariant reference remain executable?
3. Did validate-pack.sh pass locally?
4. Did this PR add duplicate DDL, hash inputs, or cross-plane authority wording?
5. Did owner sign-off change if the affected contract is release-blocking?
```

## Versioning rule

Patch versions close review findings and clarify implementation. Minor versions change the active strategy baseline. Major version remains reserved for a release-candidate baseline with Phase 0 evidence.

## Archival rule

Historical v0.12.x and older v0.13.x files remain for audit context. They are not current instructions unless an active v0.13.3 file explicitly links to them.
