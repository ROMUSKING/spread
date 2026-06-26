---
version: "0.13.3"
last-reviewed: "2026-06-26"
status: "post-MVP security middleware contract"
owner: "Security Owner + Data Platform Owner"
---

# RetrievalRevalidator

## Purpose

Prevent derived planes from becoming accidental authorities. `RetrievalRevalidator` is the mandatory service/middleware that re-checks tenant, permission, data classification, source version, and deterministic authority before any user-visible AI, pgvector, DuckDB, or cross-plane result is returned.

## Placement

```text
retrieval candidate from pgvector/DuckDB/support bundle
  -> RetrievalRevalidator
  -> deterministic source lookup
  -> user-visible response or filtered rejection
```

It runs after candidate generation and before response construction.

## Inputs

```ts
type RetrievalCandidate = {
  tenantId: string;
  userId: string;
  objectType: string;
  objectId: string;
  sourcePlane: 'postgres_projection' | 'pgvector' | 'duckdb_snapshot' | 'policy_doc' | 'runbook';
  sourceVersion: string;
  projectionVersion?: string;
  sourceHighWatermarkOutboxId?: string;
  permissionScopeHash: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'regulated' | 'blocked';
  redactionPolicyVersion: string;
  chunkId?: string;
  analyticsArtifactId?: string;
  retrievalId: string;
};
```

## Required checks

| Check | Behavior on failure |
|---|---|
| Tenant matches authenticated session | Drop candidate and audit. |
| User still has permission for object/workbook/scope | Drop candidate and audit. |
| Candidate data class is allowed for user/session/purpose | Drop; block if regulated/blocked. |
| Source object still exists and is visible | Drop candidate. |
| Source version is current enough for the retrieval mode | Mark stale or drop. |
| Redaction policy is current | Re-redact or drop. |
| Deterministic source exists for cited numeric/ledger fact | Fetch deterministic fact; do not rely on vector/analytics text. |
| Candidate output would imply mutation | Convert to command proposal requiring explicit user confirmation. |

## Deterministic authority map

| Question/result type | Authority used by revalidator |
|---|---|
| Operational row or cell | PostgreSQL projection + permission compiler. |
| Command outcome | `command_log` status API. |
| Financial/stock/credit quantity | PostgreSQL numeric projection in MVP; TigerBeetle-derived projection after cutover. |
| Analytics aggregate | DuckDB artifact manifest + PostgreSQL source high-watermark. |
| Semantic chunk | `ai_source_registry` + `ai_chunk_registry` + permission scope. |
| Policy/runbook | Approved document registry and version. |

## Pseudocode

```ts
async function revalidateCandidates(ctx, candidates) {
  const allowed = [];
  for (const c of candidates) {
    assertSameTenant(ctx.tenantId, c.tenantId);
    const source = await sourceRegistry.lookup(c.tenantId, c.objectType, c.objectId);
    if (!source || source.invalidatedAt) continue;
    if (!permissionCompiler.canRead(ctx.userId, source.permissionScopeHash)) continue;
    if (!classificationPolicy.canExpose(ctx, c.dataClassification)) continue;
    if (source.sourceVersion !== c.sourceVersion && !freshnessPolicy.allowsStale(c)) continue;
    const redacted = await redactionPolicy.applyCurrent(ctx, source);
    allowed.push({ ...c, redacted });
  }
  await retrievalAudit.write(ctx, candidates.length, allowed.length);
  return allowed;
}
```

## API contract

The retrieval API must expose whether revalidation ran, but not internal permission details:

```json
{
  "retrievalId": "uuid",
  "revalidation": {
    "status": "passed",
    "sourceHighWatermarkOutboxId": "123456",
    "filteredCandidateCount": 7,
    "returnedCandidateCount": 5
  }
}
```

## Required tests

```text
ci://tests/ai/retrieval-revalidator-required
ci://tests/ai/retrieval-revalidator-filters-stale-source
ci://tests/ai/retrieval-revalidator-blocks-regulated-data
ci://tests/ai/retrieval-revalidator-requires-deterministic-ledger-fact
ci://tests/synergy/retrieval-revalidator-runs-before-cross-plane-answer
ci://tests/synergy/retrieval-revalidator-blocks-direct-mutation
```

## Observability

```text
span: erp.retrieval.revalidate
metrics:
  erp_retrieval_revalidation_duration_ms
  erp_retrieval_candidates_filtered_total
  erp_retrieval_regulated_candidates_blocked_total
  erp_retrieval_stale_candidates_filtered_total
  erp_retrieval_direct_mutation_attempt_blocked_total
```


## v0.13.3 implementation sketch

`RetrievalRevalidator` may be implemented as a service plus API middleware/decorator. Candidate generators call it before response construction; response construction must accept only `RevalidatedCandidate[]`.

```ts
export function requiresRetrievalRevalidation(handler: RetrievalHandler): RetrievalHandler {
  return async (ctx, request) => {
    const candidates = await handler.generateCandidates(ctx, request);
    const revalidated = await retrievalRevalidator.revalidate(ctx, candidates);
    return handler.renderResponse(ctx, request, revalidated);
  };
}

class RetrievalRevalidator {
  async revalidate(ctx: RevalidationContext, candidates: RetrievalCandidate[]): Promise<RevalidatedCandidate[]> {
    const capped = candidates.slice(0, 100);
    const sourceRows = await this.sourceRegistry.batchLoadCurrentSources(ctx.tenantId, capped);
    const permissionRows = await this.permissionCompiler.batchCanRead(ctx.userId, sourceRows);

    return capped.flatMap((candidate) => {
      const source = sourceRows.get(candidate.sourceKey);
      if (!source || source.invalidatedAt) return [];
      if (!permissionRows.get(source.permissionScopeHash)) return [];
      if (!this.classificationPolicy.canExpose(ctx, source.dataClassification)) return [];
      if (source.sourceVersion !== candidate.sourceVersion && candidate.freshnessClass === 'online') return [];
      if (source.redactionPolicyVersion !== ctx.redactionPolicyVersion) return [];
      return [this.toRevalidatedCandidate(candidate, source)];
    });
  }
}
```

## Caching rules

| Cache | Allowed? | Key must include | TTL |
|---|---:|---|---:|
| Source existence/version cache | Yes | `tenant_id`, `object_type`, `object_id`, `source_version`, `outbox_high_watermark` | 30s max |
| Permission decision cache | Yes | `tenant_id`, `user_id`, `permission_scope_hash`, `permission_policy_version` | 15s max |
| Classification exposure cache | Yes | `purpose`, `data_classification`, `classification_policy_version` | 60s max |
| Regulated-data allow cache | No by default | N/A | 0s |
| Negative permission cache | Yes | same as permission decision | 15s max |

Cache invalidation is driven by outbox high-watermark changes and policy-version changes. A cache hit may only preserve or reduce visibility; it must never expand visibility beyond the current permission compiler result.

## Performance budget

| Target | Budget | Evidence |
|---|---:|---|
| Revalidate 50 candidates | p95 <= 30 ms | `BENCH-AI-REVALIDATOR-001` |
| Revalidate 100 candidates | p95 <= 60 ms | `BENCH-AI-REVALIDATOR-001` |
| Permission cache hit path | p95 <= 10 ms | `ci://benchmarks/BENCH-AI-REVALIDATOR-001` |
| Regulated data escape | 0 | `ci://tests/ai/retrieval-revalidator-blocks-regulated-data` |

## Failure behavior

- If the revalidator cannot reach the source registry, return no candidate results and emit a degraded response.
- If permission compilation fails, fail closed.
- If a deterministic numeric fact cannot be fetched, remove that fact from the answer rather than citing pgvector or DuckDB text as authority.
- If the candidate implies a mutation, convert it into a command proposal that requires explicit user confirmation and `command_log` execution.

## Required implementation tests

- `ci://tests/ai/retrieval-revalidator-middleware-required`
- `ci://tests/ai/retrieval-revalidator-cache-key-policy-versioned`
- `ci://tests/ai/retrieval-revalidator-cache-cannot-expand-permissions`
- `ci://benchmarks/BENCH-AI-REVALIDATOR-001`

## v0.13.3 Reference implementation sketch

### Placement as middleware/decorator

The retrieval endpoint must return candidates to the revalidator, not user-visible answer text. Answer construction happens only after revalidation.

```ts
type RetrievalHandler = (ctx: RequestContext, query: RetrievalQuery) => Promise<RetrievalCandidate[]>;

function withRetrievalRevalidation(handler: RetrievalHandler): RetrievalHandler {
  return async (ctx, query) => {
    const candidates = await handler(ctx, query);
    const result = await retrievalRevalidator.revalidate(ctx, query, candidates);
    metrics.observe('erp_retrieval_revalidator_duration_ms', result.durationMs, {
      source_plane: query.sourcePlane,
      candidate_bucket: bucket(candidates.length),
    });
    if (result.blockedReason) {
      audit.writeRetrievalBlock(ctx, query.retrievalId, result.blockedReason);
      return [];
    }
    return result.allowedCandidates;
  };
}

export const semanticSearch = withRetrievalRevalidation(pgvectorCandidateSearch);
export const analyticsAnswer = withRetrievalRevalidation(duckdbCandidateSearch);
export const mixedPlaneAnswer = withRetrievalRevalidation(mixedCandidateSearch);
```

### Cache policy

| Cache | Key | TTL/boundary | Invalidated by |
|---|---|---:|---|
| Auth/session scope | `tenant_id + user_id + session_id` | request lifetime | session change |
| Permission scope decision | `tenant_id + user_id + permission_scope_hash + policy_version` | <= 30 seconds | permission outbox event or policy version change |
| Classification policy | `classification_policy_version` | <= 5 minutes | compliance policy outbox event |
| Redaction policy | `redaction_policy_version` | <= 5 minutes | redaction policy outbox event |
| Source metadata | `tenant_id + object_type + object_id + source_version` | <= 30 seconds | source version/high-watermark change |

Do not cache a final visibility verdict across users unless the key includes `permission_scope_hash`, `source_version`, `redaction_policy_version`, and `data_classification`.

### Performance budget

| Scenario | Budget |
|---|---:|
| 20 candidates, warm permission/classification cache | p95 <= 25 ms |
| 50 candidates, warm permission/classification cache | p95 <= 30 ms |
| 50 candidates, cold source metadata cache | p95 <= 100 ms |
| Any regulated/blocked candidate present | fail-closed; latency budget is secondary |

If revalidation exceeds budget, return a degraded response with fewer candidates or a retryable retrieval error. Do not bypass revalidation to meet latency.

### Additional tests

```text
ci://tests/ai/retrieval-revalidator-warm-cache-budget
ci://tests/ai/retrieval-revalidator-cold-cache-degrades-not-bypasses
ci://tests/ai/retrieval-revalidator-cache-key-includes-permission-scope
ci://tests/ai/retrieval-revalidator-blocks-when-redaction-policy-unavailable
```

## Reference implementation sketch

`RetrievalRevalidator` may be implemented as a service plus mandatory API middleware/decorator. The service owns the checks; middleware owns placement.

```ts
type RetrievalMode = 'online' | 'snapshot' | 'mixed' | 'support';

type RevalidationPolicy = {
  maxCandidatesIn: number;
  maxCandidatesOut: number;
  p95BudgetMs: number;
  allowStaleSnapshotSeconds: number;
};

export function requiresRetrievalRevalidation(mode: RetrievalMode) {
  return function wrap(handler: RetrievalHandler): RetrievalHandler {
    return async (ctx, req) => {
      const raw = await handler(ctx, req);
      const validated = await retrievalRevalidator.revalidate(ctx, raw.candidates, {
        mode,
        maxCandidatesIn: 50,
        maxCandidatesOut: req.limit ?? 20,
        p95BudgetMs: 30,
      });
      return responseBuilder.withRevalidationMetadata(raw, validated);
    };
  };
}
```

## Caching rules

| Cache | Key | Max lifetime | Notes |
|---|---|---:|---|
| Source metadata | `tenant_id + object_type + object_id + source_version` | 60s | Must invalidate on outbox high-watermark advance for the object. |
| Permission decision | `tenant_id + user_id + permission_policy_version + permission_scope_hash` | request-scoped by default; 30s only after Security approval | Never cache allow decisions for regulated data across requests in MVP/P1. |
| Classification/redaction policy | `policy_version` | 5m | Policy version must be included in candidate metadata. |
| Deterministic numeric fact | `tenant_id + fact_type + object_id + projection_version` | request-scoped | Must be fetched from PostgreSQL/TigerBeetle-derived projection, not vector text. |

Mandatory invalidation signals:

```text
permission policy version changes
redaction policy version changes
source invalidated_at set
source_version changes
outbox high-watermark passes an event for the source object
regulated classification appears in candidate set
```

## Performance budget

```text
p95 <= 30 ms for 20 returned candidates
p99 <= 75 ms for 50 input candidates in staging/pilot
regulated-data block path must fail closed even if slower
```

If the budget is exceeded, the retrieval API must degrade by reducing candidates, falling back to deterministic lookup, or returning a partial answer with `revalidation.status = "partial_filtered"`. It must not skip revalidation.

## Failure behavior

| Failure | API behavior |
|---|---|
| Permission compiler unavailable | Drop all non-public candidates; return degraded deterministic-only response where possible. |
| Source registry unavailable | Fail closed for AI/analytics retrieval. |
| Redaction policy unavailable | Fail closed unless source is explicitly public. |
| Deterministic ledger fact unavailable | Do not answer numeric fact from vector/DuckDB text; return explanation unavailable. |
| Revalidator exceeds timeout | Cancel remaining candidates and return only already-validated candidates, or fail closed if none. |


---

## v0.14 external integration note

External integration policies are canonical in `docs/data/external-integration-strategy-options.md` and `docs/data/external-integration-contract.md`. This document may reference those contracts but must not restate connector authority rules.


## v0.14.1 integration-derived data rule

External integration data entering pgvector, DuckDB, AI summaries, support bundles, or UI derived-plane tiles is candidate context only. `RetrievalRevalidator` must re-check tenant, permission scope, data classification, redaction policy, source version, and integration approval before the result becomes user-visible.
