---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "active log"
---

# Decision and Waiver Log

## Rule

No silent deviations. Any departure from Phase 0 order, SLOs, privacy rules, retention rules, or compliance gates must be recorded here before merge.

## Open waivers

| ID | Date | Decision/waiver | Owner | Approver | Expiry | Compensating control | Rollback trigger | Status |
|---|---|---|---|---|---|---|---|---|
| None | - | - | - | - | - | - | - | - |

## Closed decisions

| ID | Date | Decision | Rationale | Owner | Evidence |
|---|---|---|---|---|---|
| D-001 | 2026-06-26 | Keep polling-first outbox delivery in Phase 0. | Avoid commit-path risk from notification queue behavior. | Platform/SRE Owner | ADR-0015, P0-LIVE-001 |
| D-002 | 2026-06-26 | Use tenant-hash command_log scale path rather than time-range partitioning as the first recommendation. | Preserves tenant-scoped command uniqueness without adding `created_at` to the idempotency key. | API/Client Owner | `docs/data/command-outbox-retention-partitioning.md` |

## v0.16.1 validation waiver template

```yaml
- id: DOC-WAIVER-YYYYMMDD-XXX
  date: 2026-06-26
  requestedBy: "owner"
  scope: "non-release-blocking validation warning"
  reason: "temporary reason"
  expires: 2026-07-03
  owners: ["Engineering", "QA"]
  releaseBlocker: false
```
