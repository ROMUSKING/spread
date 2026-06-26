# Vertical Slice Release Note Template

**Target version:** v0.17.x  
**Use when:** first end-to-end safe cell edit passes P0-CMD-001 and P0-LIVE-001 evidence.

## Summary

```text
One safe spreadsheet edit now travels through command_api, PostgreSQL transaction, audit/domain/outbox events, polling-first SSE, and command-status recovery.
```

## Evidence

- Command identity and unknown-outcome recovery:
- Outbox polling replay and full-refresh fallback:
- Security invariant CI run:
- Smoke typecheck and package smoke tests:
- Validation output:

## Known exclusions

```text
TigerBeetle, pgvector, DuckDB, broker/CDC fan-out, external connector runtime, and full tiled workspace remain disabled outside post-MVP evidence gates.
```
