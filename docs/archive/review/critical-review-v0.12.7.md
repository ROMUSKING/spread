---
version: "0.12.7"
last-reviewed: "2026-06-26"
status: "review closure"
---

# Critical Review Closure v0.12.7

## Review addressed

This version addresses the v0.12.6 critical review focused on centralization, TigerBeetle implementation detail, live-update scalability, client UX, security/compliance, testing/observability, cognitive load, and archive-regression checks.

## Closure summary

| Review area | Resolution |
|---|---|
| DDL duplication | Canonical schema sources defined; duplicate `CREATE TABLE` validation fails outside data contracts. |
| Schema evolution | Added schema evolution playbook and spec section. |
| TigerBeetle ID algorithm | Added SHA-256/128 reference algorithm, TypeScript code, test vectors, and fuzz/parity tests. |
| Node type mapping | Added BigInt/string, timestamp, and error/retry mapping. |
| Shadow/cutover risk | Added shadow SLOs, replay-window guidance, and three TigerBeetle runbooks. |
| Stock scalability | Added high-cardinality SKU test and default/strict stock guardrails. |
| Live-update scalability | Added wake-up coalescing and 100+ SSE subscriber benchmark evidence. |
| Client UX | Added ambiguity copy, retry-after-refresh pattern, command-ID pending diagnostics, offline queue guardrails. |
| Security/compliance | Added encrypted response refs, key rotation/audit, ledger mirror RLS example, and no-PII `user_data_*` rule. |
| Testing | Added chaos-test plan and additional manifest CI jobs. |
| Cognitive load | Added archive recovery audit, compatibility pointers, changelog index, and ledger sub-pack index. |

## Archive comparison result

Previous archives were inspected for missing content. Useful lost content was restored as compatibility pointers or canonical docs. Older versioned specs were intentionally not restored to avoid normative ambiguity.
