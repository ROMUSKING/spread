# Gate: P0-BATCH-001 - Transactional Batch Partition Validation

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Owner:** Backend/Domain Model Owner  
**Priority:** P0  
**Waiver allowed:** No for transactional_batch  
**Normative spec:** v0.17.0 sections 7 and 12.4  
**SLO reference:** `docs/slo-baseline.yml`

## Requirement

`transactional_batch` may commit partially only by validated dependency partitions.

## Required behavior

- Every eligible workbook has a `BatchPartitionPolicy`.
- Partition compiler builds graph connected components from row mutations.
- Edges include declared partition keys, SQL foreign keys, formula AST references, aggregate dependencies, and custom domain rules.
- Compiler uses Union-Find or equivalent O(V + E) implementation for connected components.
- 10k-row paste fixture validates in <= `batch_10k_validation_ms` target unless waived.
- Custom domain rules include positive and negative fixtures.
- Hidden dependencies fail closed.
- Missing policy forces `atomic` or rejection.

## Evidence required

- `ci://tests/batch/partition-policy-validation`
- `ci://tests/fuzz/batch-partitioner`
- `ci://benchmarks/BENCH-BATCH-001`
- `repo://workbooks/*/batch-partition-policy.yml`
- `repo://tests/fixtures/batch/**/*`

## Failure behavior

Disable `transactional_batch` for affected workbook and fall back to `atomic` or rejection.


## v0.17.0 active baseline note

This P0 gate is active under the v0.17.0 AI coding-agent implementation-roadmap baseline.
