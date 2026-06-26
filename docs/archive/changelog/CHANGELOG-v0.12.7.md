# CHANGELOG v0.12.7

## Status

Implementation-readiness review closure.

## Changes

- Centralized canonical DDL into:
  - `docs/data/command-outbox-retention-partitioning.md`
  - `docs/data/numeric-ledger-contract.md`
- Added `docs/data/schema-evolution-playbook.md`.
- Removed canonical `CREATE TABLE` blocks from the main spec and TigerBeetle field policy.
- Added exact deterministic ID derivation algorithm, TypeScript reference implementation, and test vectors.
- Added Node.js BigInt/string mapping, timestamp semantics, and TigerBeetle error/retry mapping.
- Restored useful content and compatibility pointers from previous archives.
- Restored standalone ledgerability classification table.
- Added TigerBeetle shadow worker, reconciliation, and cutover/rollback runbooks.
- Added live-update wake-up coalescing guidance and 100+ SSE subscriber benchmark evidence.
- Expanded client ambiguity/conflict UX guidance.
- Added encrypted `response_ref`, ledger mirror RLS, and `user_data_*` no-PII controls.
- Added DDoS/credential-stuffing boundary for rate limiting.
- Added chaos-test plan.
- Added consolidated changelog index.
- Strengthened validation to fail on DDL duplication and missing recovered-content docs.
