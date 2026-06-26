# Rate Limiter

**Version:** 0.13.2  
**Last-reviewed:** 2026-06-26

## Purpose

Define hot-path limiter behavior without PostgreSQL counter contention.

## Normative behavior

Ordinary edits use edge and per-instance local buckets. Active-instance heartbeats divide tenant budget with headroom. PostgreSQL counters are reserved for high-risk ceilings or async observations.

## API/schema examples

See `docs/api/command-status.openapi.yml` for 429 response contract.

## Failure modes

If heartbeat data is stale, local budgets become more conservative. If limiter overhead exceeds SLO, block release.

## Required tests

- `ci://tests/rate-limit/local-token-bucket`
- `ci://tests/rate-limit/cross-instance-budget-division`
- `ci://benchmarks/BENCH-RATE-001`

## Observability fields

- `tenant_id`
- `user_id`
- `workbook_id`
- `command_type`
- `risk_class`
- `rate_limit_policy`
- `rate_limit_remaining`

## Owner role

Platform/API Owner

## Links

- `docs/gates/P0-RATE-001-hot-path-rate-limit-safety.md`
- `docs/slo-baseline.yml`

## Abuse and credential-stuffing boundary

The edit hot-path limiter is not the only abuse control. Production must also include outer controls for high-risk abuse:

| Threat | Required control |
|---|---|
| Credential stuffing | Edge/auth limiter by IP, account, tenant, and ASN/risk signal. |
| Session token spray | Auth service risk scoring and lockout/backoff. |
| DDoS against edit endpoints | WAF/load-balancer limits before API process saturation. |
| High-risk import/export abuse | PostgreSQL coarse ceiling or queue admission check before expensive work. |
| Cross-tenant noisy neighbor | Tenant-level local budget plus coarse PostgreSQL ceiling and SRE alerts. |

Ordinary edit commands must still avoid synchronous PostgreSQL rate-counter writes. High-risk commands may use PostgreSQL coarse ceilings on request path.

Evidence:

```text
ci://tests/rate-limit/credential-stuffing-throttled-before-edit-path
ci://tests/rate-limit/high-risk-command-postgres-ceiling
ci://tests/rate-limit/no-ordinary-edit-pg-counter-write
```

## Heartbeat worst-case examples

| Scenario | Risk | Expected behavior |
|---|---|---|
| instance dies after heartbeat | active count temporarily high | tenants are under-budgeted; safe failure |
| autoscale adds instances before all heartbeats visible | active count temporarily low | `+1` headroom and edge limiter cap burst |
| network partition isolates one instance | local overspend | edge and coarse ceilings bound damage |
| reconnect storm with 100+ SSE subscribers | budgets and demand spike | local limiter sheds ordinary edits first |

Evidence: `ci://tests/rate-limit/heartbeat-skew-worst-case-budget`.
