---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "active maintenance guide"
owner: "Engineering Lead"
---

# Pack Evolution Guide

## Purpose

Keep the pack implementable as it grows. The goal is to prevent a large architecture pack from becoming a contradiction-prone document dump.

## Change classes

| Change class | Required action |
|---|---|
| Editorial summary | Update the local doc; no new invariant unless behavior changes. |
| Normative behavior | Update the canonical source listed in `docs/maintenance/normative-source-map.md`. |
| New schema | Add DDL only in the canonical data-contract file. |
| New gate evidence | Update `tests/manifest.yml`, `docs/slo-baseline.yml`, and relevant invariant. |
| New specialized-plane behavior | Add or update an ADR and a P1 gate. |
| Performance target change | Update `docs/slo-target-rationale.md` and require owner sign-off. |

## Condensation rule

When a topic has more than three summaries across active docs:

```text
1. choose one canonical document;
2. replace other copies with a one-paragraph summary and link;
3. add or update validation if drift would be dangerous;
4. record the change in the changelog.
```

## Active versus historical files

Active implementation follows:

```text
README.md
docs/pack-index.md
active spec path from README
requiredDocs in tests/manifest.yml
canonical docs in normative-source-map
```

Historical v0.12.x and older v0.13.x reviews/changelogs remain for audit continuity but are not implementation instructions.

## PR checklist for pack evolution

```text
- Does this change alter runtime behavior or just wording?
- Is there exactly one canonical source for the changed contract?
- Are gate cards linking rather than copying long normative text?
- Did the manifest and invariant list change if evidence changed?
- Did validation fail before the fix and pass after the fix?
- Is an owner sign-off required?
```
