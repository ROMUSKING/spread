/**
 * AGENT-040 — Batch Partition Compiler
 *
 * Implements BatchPartitionPolicy compiler using Union-Find to group mutations
 * into transactional connected components, validating custom domain rules
 * and failing closed on hidden dependencies, unknown fields, or timeouts.
 *
 * @see docs/dev/batch-partition-policy.md
 * @see docs/gates/P0-BATCH-001-transactional-batch-partition-validation.md
 */

import { getTracer, getMetrics } from '@erp/observability';

export type BatchPartitionPolicy = {
  version: string;
  workbook: string;
  partitionKeys: string[];
  foreignKeys?: Array<{
    field: string;
    references: string;
  }>;
  formulaReferences?: Array<{
    field: string;
    dependsOn: string[];
  }>;
  aggregateDependencies?: Array<{
    field: string;
    dependsOn: string;
  }>;
  customDomainRules?: Array<{
    name: string;
    expression: string;
  }>;
  fallbackBehavior: 'atomic' | 'reject';
};

export type Mutation = {
  rowId: string;
  objectName?: string;
  recordId?: string;
  fields: Record<string, any>;
};

export class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  add(v: string): void {
    if (!this.parent.has(v)) {
      this.parent.set(v, v);
      this.rank.set(v, 0);
    }
  }

  find(v: string): string {
    const p = this.parent.get(v);
    if (p === undefined) {
      throw new Error(`unknown vertex ${v}`);
    }
    if (p !== v) {
      const root = this.find(p);
      this.parent.set(v, root);
      return root;
    }
    return v;
  }

  union(a: string, b: string): void {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    const rka = this.rank.get(ra)!;
    const rkb = this.rank.get(rb)!;
    if (rka < rkb) {
      this.parent.set(ra, rb);
    } else {
      this.parent.set(rb, ra);
      if (rka === rkb) {
        this.rank.set(ra, rka + 1);
      }
    }
  }
}

/**
 * Evaluate custom domain rule expression (e.g. "quantity >= 0")
 */
function evaluateRule(
  fields: Record<string, any>,
  expression: string,
): boolean {
  const match = expression.match(/^(\w+)\s*(>=|<=|>|<|==|!=)\s*(-?\d+)$/);
  if (!match) {
    throw new Error(`Unsupported expression format: ${expression}`);
  }
  const field = match[1]!;
  const operator = match[2]!;
  const valStr = match[3]!;
  const value = fields[field];
  if (value === undefined) {
    throw new Error(`Unknown field: ${field}`);
  }
  const val = parseFloat(valStr);
  const actual = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(actual)) return false;

  switch (operator) {
    case '>=':
      return actual >= val;
    case '<=':
      return actual <= val;
    case '>':
      return actual > val;
    case '<':
      return actual < val;
    case '==':
      return actual === val;
    case '!=':
      return actual !== val;
    default:
      return false;
  }
}

function isPolicyPartitioningError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('Compile timeout exceeded') ||
    error.message.includes('Hidden dependency or unknown field')
  );
}

/**
 * Main entrypoint to compile connected components/partitions from a list of mutations.
 * Timeout constraint: default 200ms.
 */
export function compilePartitions(
  mutations: Mutation[],
  policy: BatchPartitionPolicy,
  timeoutMs: number = 200,
): Mutation[][] {
  const compileStart = Date.now();
  const tracer = getTracer();
  const metrics = getMetrics();
  let edgeCount = 0;

  if (!policy) {
    throw new Error('ASSERT_FAILED: Missing batch partition policy');
  }
  if (!Array.isArray(mutations)) {
    throw new Error(
      'ASSERT_FAILED: mutations must be array for compilePartitions',
    );
  }

  const uf = new UnionFind();
  for (const m of mutations) {
    uf.add(m.rowId);
  }

  const fieldToMutations = new Map<string, Mutation[]>();
  const targetMutationsByObject = new Map<string, Map<string, Mutation[]>>();

  for (const mutation of mutations) {
    for (const fieldName of Object.keys(mutation.fields)) {
      const fieldMutations = fieldToMutations.get(fieldName) ?? [];
      fieldMutations.push(mutation);
      fieldToMutations.set(fieldName, fieldMutations);
    }

    if (mutation.objectName && mutation.recordId) {
      const recordsById =
        targetMutationsByObject.get(mutation.objectName) ??
        new Map<string, Mutation[]>();
      const recordMutations = recordsById.get(mutation.recordId) ?? [];
      recordMutations.push(mutation);
      recordsById.set(mutation.recordId, recordMutations);
      targetMutationsByObject.set(mutation.objectName, recordsById);
    }
  }

  let partitions: Mutation[][];

  try {
    // 1. Build Partition Key Edges
    // Group mutations by partition key values (e.g., productId + warehouseId values concatenated)
    const partitionGroups = new Map<string, Mutation[]>();
    for (const m of mutations) {
      if (Date.now() - compileStart > timeoutMs) {
        throw new Error('Compile timeout exceeded');
      }

      const keyValues: string[] = [];
      for (const key of policy.partitionKeys) {
        const val = m.fields[key];
        if (val === undefined) {
          throw new Error(`Hidden dependency or unknown field: ${key}`);
        }
        keyValues.push(String(val));
      }
      const groupKey = keyValues.join(':');
      let group = partitionGroups.get(groupKey);
      if (!group) {
        group = [];
        partitionGroups.set(groupKey, group);
      }
      group.push(m);
    }

    for (const group of partitionGroups.values()) {
      if (group.length > 1) {
        const first = group[0]!;
        for (let i = 1; i < group.length; i++) {
          uf.union(first.rowId, group[i]!.rowId);
          edgeCount++;
        }
      }
    }

    // 2. Build Foreign Key Edges
    if (policy.foreignKeys) {
      for (const fk of policy.foreignKeys) {
        if (Date.now() - compileStart > timeoutMs) {
          throw new Error('Compile timeout exceeded');
        }

        const targetObj = fk.references.split('.')[0];
        const targetMutations = targetObj
          ? (targetMutationsByObject.get(targetObj) ??
            new Map<string, Mutation[]>())
          : new Map<string, Mutation[]>();

        for (const mutation of mutations) {
          const fkVal = mutation.fields[fk.field];
          if (fkVal === undefined) {
            continue;
          }

          const referencedMutations = targetMutations.get(String(fkVal)) ?? [];
          for (const referencedMutation of referencedMutations) {
            uf.union(mutation.rowId, referencedMutation.rowId);
            edgeCount++;
          }
        }
      }
    }

    // 3. Build Formula Reference Edges
    if (policy.formulaReferences) {
      for (const formula of policy.formulaReferences) {
        const formulaMutations = fieldToMutations.get(formula.field) ?? [];
        const dependencyMutations = formula.dependsOn.flatMap(
          (dependency) => fieldToMutations.get(dependency) ?? [],
        );

        if (formulaMutations.length === 0 && dependencyMutations.length === 0) {
          continue;
        }

        for (const dependency of formula.dependsOn) {
          if (
            formulaMutations.length > 0 &&
            (fieldToMutations.get(dependency)?.length ?? 0) === 0
          ) {
            throw new Error(
              `Hidden dependency or unknown field: ${dependency}`,
            );
          }
        }

        const participants = [...formulaMutations, ...dependencyMutations];
        if (participants.length > 1) {
          const first = participants[0]!;
          for (let i = 1; i < participants.length; i++) {
            uf.union(first.rowId, participants[i]!.rowId);
            edgeCount++;
          }
        }
      }
    }

    // 4. Build Aggregate Dependency Edges
    if (policy.aggregateDependencies) {
      for (const aggregate of policy.aggregateDependencies) {
        const aggregateMutations = fieldToMutations.get(aggregate.field) ?? [];
        const dependencyMutations =
          fieldToMutations.get(aggregate.dependsOn) ?? [];

        if (
          aggregateMutations.length === 0 &&
          dependencyMutations.length === 0
        ) {
          continue;
        }

        if (aggregateMutations.length > 0 && dependencyMutations.length === 0) {
          throw new Error(
            `Hidden dependency or unknown field: ${aggregate.dependsOn}`,
          );
        }

        const participants = [...aggregateMutations, ...dependencyMutations];
        if (participants.length > 1) {
          const first = participants[0]!;
          for (let i = 1; i < participants.length; i++) {
            uf.union(first.rowId, participants[i]!.rowId);
            edgeCount++;
          }
        }
      }
    }

    // 5. Group by root
    const rootGroups = new Map<string, Mutation[]>();
    for (const m of mutations) {
      const root = uf.find(m.rowId);
      let group = rootGroups.get(root);
      if (!group) {
        group = [];
        rootGroups.set(root, group);
      }
      group.push(m);
    }

    partitions = [...rootGroups.values()];
  } catch (error) {
    if (
      policy.fallbackBehavior === 'atomic' &&
      isPolicyPartitioningError(error)
    ) {
      partitions = [mutations];
    } else {
      throw error;
    }
  }

  // 6. Validate each component partition against custom domain rules
  if (policy.customDomainRules) {
    for (const partition of partitions) {
      for (const m of partition) {
        for (const rule of policy.customDomainRules) {
          if (!evaluateRule(m.fields, rule.expression)) {
            throw new Error(
              `Validation failed for custom rule "${rule.name}" on row ${m.rowId}`,
            );
          }
        }
      }
    }
  }

  const durationMs = Date.now() - compileStart;
  const span = tracer.startSpan('erp.batch.partition', {
    vertices: mutations.length,
    edges: edgeCount,
    components: partitions.length,
    duration_ms: durationMs,
  });
  span.end();

  let rowBucket = '<100';
  if (mutations.length >= 10000) rowBucket = '10k';
  else if (mutations.length >= 1000) rowBucket = '1k';
  else if (mutations.length >= 100) rowBucket = '100-999';

  metrics.observe('erp_batch_partition_validation_ms', durationMs, {
    workbook_key: policy.workbook || 'unknown',
    row_bucket: rowBucket,
  });

  return partitions;
}
