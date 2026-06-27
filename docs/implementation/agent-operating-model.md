# AI Agent Operating Model

**Version:** 0.17.0  
**Last-reviewed:** 2026-06-26  
**Status:** Active execution process

## 1. Role model

| Role | Responsibility | Required output |
|---|---|---|
| Roadmap coordinator | Assign work orders and maintain dependency order. | Work-order board and dependency notes. |
| Implementation agent | Code one work order. | PR with tests and validation output. |
| Test agent | Add missing test/benchmark/fixture coverage. | CI evidence and fixture diffs. |
| Security agent | Review access control, credential, redaction, RLS, integration, and revalidation changes. | Security review note and invariant mapping. |
| Database agent | Review migrations, indexes, constraints, retention, and rollback. | Migration review note and query-plan evidence. |
| Frontend agent | Implement minimal grid/detail UX and client command states. | UI tests and accessibility notes. |
| Docs-sync agent | Update active docs when implementation decisions change. | Docs diff with normative-source map check. |
| Reviewer agent | Check that the PR did not weaken boundaries. | Review checklist and required reruns. |

## 2. Work-order lifecycle

```text
ready -> claimed -> implemented -> self-validated -> review -> changes_requested -> approved -> merged -> evidence_archived
```

A work order may not move to `implemented` until it has:

```text
- code or docs diff;
- tests or evidence update;
- validation output;
- stop-condition statement;
- known-risk note.
```

## 3. Claiming protocol

Agents should add a short claim note to the issue/ticket:

```text
Claimed by:
Work order:
Canonical docs read:
Expected files:
Expected tests:
Risk areas:
```

If two agents need the same files, the coordinator should split the task or sequence PRs.

## 4. Handoff protocol

Agent handoff must include:

```text
Work order ID:
Summary:
Files changed:
Tests added:
Commands run:
Validation output:
Evidence URIs satisfied:
Remaining TODOs:
Risks / assumptions:
Reviewer focus:
```

## 5. Review rules

A reviewer must reject a PR if it:

```text
- bypasses command handlers for operational mutation;
- bypasses outbox for outbound delivery;
- introduces post-MVP infrastructure into Phase 0 edit path;
- weakens a CHECK constraint, invariant, or validation script without owner sign-off;
- changes canonical DDL in a non-canonical file;
- adds external calls inside command transactions;
- stores secrets, raw request bodies, or regulated payloads in unsafe locations;
- makes AI/vector/analytics results user-visible without revalidation.
```

## 6. Dependency discipline

Agents must not start a downstream work order before its dependency is merged unless they work against an approved branch stack.

Branch stacks must state:

```text
base branch:
upstream PR:
conflict risk:
rebase owner:
```

## 7. Escalation

Escalate to human owners when:

```text
- tests imply a design contradiction;
- P0 gate order would need to change;
- implementation requires a new dependency;
- schema cannot satisfy both current and future plane requirements;
- performance budgets are missed by more than 15%;
- a security invariant would require waiver.
```
