---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "implementation-readiness recovery playbooks"
---

# Recovery Playbooks v0.13.3

## Outbox bloat plus retention gap

Use the outbox polling performance contract to confirm covering-index usage, reduce poll/payload budgets, and issue `SYNC_REQUIRED` for clients beyond the retained high-watermark.

## Command Boundary B rollback

If the business mutation transaction rolls back, leave `command_log` in `received` or terminalize as `failed` only after correlation checks prove no current/audit/domain/outbox/numeric rows committed.

## RetrievalRevalidator cache drift

Invalidate the cache by permission-policy version, redaction-policy version, outbox high-watermark, and source version. If drift is suspected, bypass cache and fail closed until the permission compiler can re-evaluate candidates.

## TigerBeetle shadow mismatch

Freeze cutover, classify mismatch source, rerun ledger ID derivation parity, compare payload hashes, and repair only through ledger correction/reconciliation runbooks.
