---
version: "0.13.2"
last-reviewed: "2026-06-26"
status: "post-MVP runbook"
---

# DuckDB Analytics Runbook

## Purpose

Operate the post-MVP DuckDB analytical/export plane safely.

## Normal operation

1. Export approved PostgreSQL projections by durable watermark.
2. Write Parquet artifacts with schema hash, source watermark, data classification, permission scope, and row count.
3. Register artifacts in the analytics catalog.
4. Run DuckDB queries only through approved query service or audited support bundle.
5. Return freshness metadata with every result.

## Incident: artifact completeness mismatch

```text
1. Stop publishing the affected artifact version.
2. Mark query service responses as stale/unavailable for that projection.
3. Rebuild from the last known-good watermark.
4. Compare row count and checksum against PostgreSQL projection.
5. Publish only after parity passes.
```

## Incident: blocked/regulated data exported

```text
1. Revoke artifact access immediately.
2. Rotate access tokens for support bundles.
3. Delete or quarantine exported objects according to retention policy.
4. Notify Security and Compliance owners.
5. Add regression test for the projection classification rule.
```

## Incident: DuckDB query overload

```text
1. Kill or timeout long-running query.
2. Reduce memory/output limits for the tenant or projection.
3. Disable direct read bridge if enabled.
4. Fall back to precomputed PostgreSQL projection summary.
5. Capture query profile and artifact metadata.
```

## Controls

- Query timeout.
- Memory limit.
- Output row/byte cap.
- Artifact allow-list.
- Read-only credentials.
- No operational PostgreSQL write privileges.
- Audited support bundle expiry.
