---
version: "0.12.3"
last-reviewed: "2026-06-26"
status: "current"
---

# CHANGELOG v0.12.3

## Summary

v0.12.3 is a lightweight kickoff refinement over v0.12.2. It focuses on reducing cognitive load and closing explicit schema/process gaps rather than changing core architecture.

## Added

- `docs/onboarding/engineer-onramp-day1.md`
- `docs/diagrams/architecture-context.md`
- `docs/plan/week1-vertical-slice-kickoff.md`
- `docs/plan/vertical-slice-acceptance-checklist.md`
- `docs/data/pilot-dataset-definition.md`
- `docs/dev/client-optimistic-ui-and-conflicts.md`
- `docs/process/owner-signoff-template.md`
- `docs/process/decision-waiver-log.md`
- `.github/workflows/validate-pack.yml`
- `docs/review/critical-review-v0.12.3.md`

## Changed

- Promoted active spec and pack references to v0.12.3.
- Added 15-minute engineer onramp and minimal-scope overlay to `docs/pack-index.md`.
- Strengthened `scripts/validate-pack.sh` with health score, YAML lint, Mermaid checks, version sync, placeholder/stale-reference checks, and duplicate normative text warnings.
- Made `command_log` partitioning recommendation explicit: single table first; tenant-hash partitioning as first scale path.
- Added explicit `outbox_events` schema and outbox_id range partition scale path.
- Added Union-Find pseudo-code for the batch partition compiler.
- Added numeric risk scoring and mitigation confidence.

## Unchanged architectural decisions

- Command identity remains first.
- Durable outbox polling remains the default live-update path.
- `LISTEN/NOTIFY` remains optional and benchmark-gated.
- Ordinary edit rate limiting remains off the PostgreSQL hot path.
- Transactional batch remains policy-compiled, not proof-inferred.
