# Validation Waiver Policy

**Version:** 0.17.0  
**Status:** Process control for non-release-blocking validation warnings

## Decision

`validate-pack.sh` remains strict by default. Waiver mode is allowed only for non-release-blocking documentation/process warnings.

```bash
bash scripts/validate-pack.sh --waiver DOC-WAIVER-YYYYMMDD-XXX
```

The waiver ID must appear in:

```text
docs/process/decision-waiver-log.md
```

## Non-waivable failures

The following remain hard failures even in waiver mode:

```text
missing active spec
multiple active specs
duplicate YAML keys
duplicate active ADR/gate IDs
duplicate requiredDocs
missing requiredDoc files
missing gate ci:// evidence in manifest
DDL outside canonical data-contract docs
command/outbox bypass language
post-MVP runtime admitted to Phase 0 edit path
secret/plaintext credential storage
missing release-blocking invariants
stale active spec path
unbalanced code fences in critical docs
```

## Waivable warning class

Only these warning classes may be waived:

```text
minor prose drift in non-normative review/changelog files
non-release-blocking health dashboard freshness note
non-critical generated diagram timestamp mismatch
non-canonical historical compatibility pointer mismatch
```

## Required waiver-log entry

```yaml
- id: DOC-WAIVER-YYYYMMDD-XXX
  date: 2026-06-26
  requestedBy: "Reviewer or owner"
  scope: "non-release-blocking validation warning"
  reason: "why the warning is accepted temporarily"
  expires: 2026-07-03
  owners: ["Engineering", "QA"]
  releaseBlocker: false
```

A waiver with `releaseBlocker: true` is invalid for `validate-pack.sh --waiver`.
