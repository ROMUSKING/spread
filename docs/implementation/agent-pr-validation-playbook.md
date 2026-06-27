# Agent PR Validation Playbook

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Status:** Active PR checklist for AI coding agents

## Required local commands

Run all commands that exist in the repository. If a command does not exist, state that explicitly in the PR.

```bash
bash scripts/validate-pack.sh
npm run lint
npm run typecheck
npm test
npm run test:integration
```

Gate-specific commands should be run when relevant:

```bash
npm run test:command
npm run test:outbox
npm run test:security-invariants
npm run test:rate-limit
npm run test:batch
npm run bench:outbox-polling
npm run bench:batch-partition
```

## Required PR body

```markdown
## Work order
- ID:
- Gate:
- Dependencies merged:

## Summary

## Canonical docs read
- 

## Files changed
- 

## Evidence
- ci://...

## Commands run
```text
...
```

## Stop-condition check
- [ ] No command bypass
- [ ] No outbox bypass
- [ ] No post-MVP runtime in Phase 0 edit path
- [ ] No direct external/TigerBeetle/broker write
- [ ] No unrevalidated derived-plane output
- [ ] No secret/raw regulated payload storage

## Risks and follow-ups
```

## Reviewer checklist

```text
- Work order scope is one coherent concern.
- Tests match the manifest evidence URI.
- SLO and benchmark metadata are captured where required.
- Migration has rollback or forward-repair plan.
- Security owner review is requested when touching auth/RLS/credentials/regulated data.
- SRE owner review is requested when touching outbox, rate limiting, observability, or background workers.
- Product owner review is requested when touching UI/UX or workflow semantics.
```

## Validation failure triage

If validation fails:

1. Do not weaken `scripts/validate-pack.sh` to pass.
2. Identify whether the failure is pack drift, implementation drift, or a false positive.
3. If false positive, add a narrow validation improvement with a test explaining the case.
4. If pack drift, update the canonical doc and manifest together.
5. If implementation drift, fix implementation or stop for owner review.


## Good PR handoff example

```text
Work order: AGENT-010 Command log schema and migration
Files changed: packages/db/migrations/..., packages/domain/commands/...
Canonical docs used: docs/dev/command-lifecycle.md, docs/data/command-outbox-retention-partitioning.md, apps/api/src/commands/CommandHandlerBase.ts
Validation: bash scripts/validate-pack.sh PASS
Evidence: ci://tests/api/command-id-reuse-conflict PASS, ci://tests/api/command-status-ttl PASS
Boundary check: no external calls, no direct outbox bypass, no post-MVP runtime
Known follow-up: AGENT-011 command status API
```

## Bad PR rejection example

```text
Work order: AGENT-021 Outbox poller
Issue: PR writes directly to WebSocket clients from domain handler and skips outbox_events.
Required reviewer response: reject. This violates OUTBOX-001 and P0-LIVE-001. Agent must revert and route delivery through durable outbox polling.
```


## Concrete PR handoff examples

See `docs/implementation/pr-handoff-examples.md` for full good and rejected diff-style examples.


## v0.17.0 package smoke tests

```bash
bash scripts/smoke-package-tests.sh
```

Every workspace package contains `test/smoke.test.mjs`. These tests are dependency-free and prove package metadata and required bootstrap source stubs exist.
