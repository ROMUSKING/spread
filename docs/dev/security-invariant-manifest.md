# Security Invariant Manifest

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Purpose

Define how release-blocking invariants become executable CI checks.

## Normative behavior

Every invariant has ID, title, category, severity, check type, evidence URI, owner, and applies-to list. All `release_blocker` invariants run in CI before merge or release.

## API/schema examples

See `invariants/security-invariants.yml` for canonical schema and entries.

## Failure modes

Missing evidence URI or unsupported scheme blocks merge. Failed release blocker blocks release.

## Required tests

- `ci://tests/security/invariant-manifest-validation`
- `ci://tests/security/release-blocker-invariants`

## Observability fields

- `invariant_id`
- `evidence_uri`
- `severity`
- `owner`
- `ci_job_id`

## Owner role

Security Owner

## Links

- `docs/gates/P0-INV-001-security-invariant-ci-enforcement.md`
- `invariants/security-invariants.yml`
- `tests/manifest.yml`
