# Gate: P0-INV-001 - Security Invariant CI Enforcement

**Version:** 0.16.1  
**Last-reviewed:** 2026-06-26  
**Owner:** Security Owner  
**Priority:** P0  
**Waiver allowed:** Emergency waiver only by CTO and Security Owner  
**Normative spec:** v0.16.1 sections 9 and 12.3  
**SLO reference:** `docs/slo-baseline.yml`

## Requirement

Security invariants must be executable checks enforced by CI, not prose-only requirements.

## Required behavior

- `invariants/security-invariants.yml` exists before permission-sensitive features merge.
- All `release_blocker` checks run in CI.
- PRs that alter access control, formulas, imports, exports, RLS, tenant context, outbox/audit writes, or query compilation update relevant invariant checks.
- Evidence URIs must use approved schemes: `ci://`, `sql://`, `repo://`, `dashboard://`.
- Observability and compliance invariants are included, not deferred.

## Evidence required

- `repo://invariants/security-invariants.yml`
- `ci://tests/security/invariant-manifest-validation`
- `ci://tests/security/release-blocker-invariants`
- `ci://tests/security/evidence-uri-scheme-validation`

## Failure behavior

Block merge and release if release-blocking invariants fail or evidence references are missing.


## v0.16.1 active baseline note

This P0 gate is active under the v0.16.1 AI coding-agent implementation-roadmap baseline.
