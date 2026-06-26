# Batch Partition Policy

**Version:** 0.13  
**Last-reviewed:** 2026-06-26

## Purpose

Define policy-based transactional-batch partition compilation.

## Normative behavior

`transactional_batch` is enabled only with a validated policy. The compiler constructs a graph and commits connected components independently. Missing or invalid dependencies fail closed.

## Implementation recommendation

Use a hand-rolled Union-Find/Disjoint Set implementation in TypeScript for the hot path. `graphology` or similar libraries may be used in diagnostics/tests, but the production compiler should stay dependency-light until a benchmark proves a library is faster and safer.

Expected complexity: `O(V + E * alpha(V))`, effectively linear for Phase 0 sizes. `BENCH-BATCH-001` must compile a 10k-row paste in the `batch_10k_validation_ms` SLO budget.

## Pseudo-code

```ts
type VertexId = string;

type Mutation = {
  rowId: string;
  objectName: string;
  recordId: string;
  fields: Record<string, unknown>;
};

class UnionFind {
  private parent = new Map<VertexId, VertexId>();
  private rank = new Map<VertexId, number>();

  add(v: VertexId): void {
    if (!this.parent.has(v)) {
      this.parent.set(v, v);
      this.rank.set(v, 0);
    }
  }

  find(v: VertexId): VertexId {
    const p = this.parent.get(v);
    if (p === undefined) throw new Error(`unknown vertex ${v}`);
    if (p !== v) this.parent.set(v, this.find(p));
    return this.parent.get(v)!;
  }

  union(a: VertexId, b: VertexId): void {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    const rka = this.rank.get(ra)!;
    const rkb = this.rank.get(rb)!;
    if (rka < rkb) [ra, rb] = [rb, ra];
    this.parent.set(rb, ra);
    if (rka === rkb) this.rank.set(ra, rka + 1);
  }
}

function compilePartitions(mutations: Mutation[], policy: BatchPartitionPolicy): Partition[] {
  const uf = new UnionFind();
  for (const m of mutations) uf.add(vertexId(m));

  for (const edge of samePartitionKeyEdges(mutations, policy)) uf.union(edge.a, edge.b);
  for (const edge of foreignKeyEdges(mutations, policy)) uf.union(edge.a, edge.b);
  for (const edge of formulaReferenceEdges(mutations, policy)) uf.union(edge.a, edge.b);
  for (const edge of aggregateDependencyEdges(mutations, policy)) uf.union(edge.a, edge.b);
  for (const edge of customDomainRuleEdges(mutations, policy)) uf.union(edge.a, edge.b);

  return groupByRoot(mutations, (m) => uf.find(vertexId(m)));
}
```

## API/schema examples

Policy files live at `workbooks/*/batch-partition-policy.yml` and must include keys, dependency edges, custom rule fixtures, and fallback behavior.

## Failure modes

Missing policy rejects or falls back to atomic. Unknown field references fail CI and runtime. Validation timeout fails affected partition closed. If compile time exceeds the SLO budget, the API fails closed for affected partitions and reports row/column-level diagnostics.

## Required tests

- `ci://tests/batch/partition-policy-validation`
- `ci://tests/fuzz/batch-partitioner`
- `ci://benchmarks/BENCH-BATCH-001`
- `ci://tests/batch/union-find-10k-budget`

## Observability fields

- `tenant_id`
- `workbook_key`
- `batch_id`
- `partition_id`
- `component_count`
- `edge_count`
- `compile_ms`
- `fail_closed_reason`

## Owner role

Backend/Domain Model Owner

## Links

- `docs/gates/P0-BATCH-001-transactional-batch-partition-validation.md`
- `docs/slo-baseline.yml`
- `docs/data/pilot-dataset-definition.md`
