# Spreadsheet-Native ERP Technical Specification v0.15.2

**Date:** 2026-06-26  
**Status:** Phase 0 implementation-readiness baseline with AI coding-agent execution roadmap, snapshot-first ergonomics, and delivery-polish controls  
**Supersedes:** v0.15.1 AI coding-agent delivery velocity baseline  
**Version note:** This is **v0.15.2**, not v1.0. Version 1.0 remains reserved for a release-candidate baseline after Phase 0 evidence exists.  
**Audience:** Phase 0 engineering, AI coding agents, reviewers, QA, SRE, security, compliance, product, and domain owners.

## 1. Executive Summary

v0.15.2 is a delivery-polish release for AI coding-agent execution. It keeps the v0.15.1 execution model and closes the remaining review items: the first-read snapshot is now more forceful, README and pack-index begin with explicit `START HERE` sections, PR handoff examples are concrete diff-style artifacts, sample agent-simulation output is attached as evidence, and execution SLOs expose numeric targets for snapshot enforcement and bad-PR rejection.

The product thesis remains unchanged: build a TypeScript-first, PostgreSQL-backed, spreadsheet-native ERP where every visible cell is a permissioned, validated, auditable projection of normalized business data.

The Phase 0 deliverable remains one safe cell edit:

```text
command identity
  -> current/audit/domain/outbox transaction
  -> polling-first SSE delivery
  -> command-status recovery
  -> invariant evidence
```

Do not introduce TigerBeetle, pgvector, DuckDB, CDC, broker fan-out, external connector runtime, full tiled UI, or AI-generated mutations into the ordinary Phase 0 edit path.

## 2. v0.15.2 Review-Closure Additions

| Area | v0.15.1 residual polish item | v0.15.2 refinement |
|---|---|---|
| Snapshot punch | Snapshot was good but could be more immediate. | Move the authority Mermaid to the top and add a five-line “What agents may NOT do today” checklist. |
| README/pack-index first read | Snapshot was linked, but not visually unavoidable. | Add `START HERE` sections at the top of README and pack-index. |
| Execution SLOs | Some process benchmarks had no visible numeric targets. | Add `snapshot_first_read_check_p95_ms`, `agent_simulation_rejection_p95_ms`, and rejection-accuracy targets. |
| PR examples | The playbook had compact examples, but not concrete diff-style examples. | Add `docs/implementation/pr-handoff-examples.md` with good and rejected examples. |
| Agent simulation evidence | The simulation plan existed, but no attached sample run output. | Add `docs/qa/agent-simulation-output-v0.15.2.md`. |
| Stale active strings | Some v0.15.1 references remained in active execution docs. | Promote active docs, manifests, invariants, and validation to v0.15.2; archive the v0.15.1 spec/snapshot. |

## 3. Snapshot Is the Mandatory First Read

Every human reviewer and AI coding agent must start with:

```text
docs/snapshot-v0.15.2.md
```

The snapshot begins with the authority map and an explicit “may not do today” checklist. `SNAP-001` requires the snapshot to exist and be referenced; `SNAP-002` requires the snapshot to remain first-read, current, and operationally enforceable.

## 4. Locked Phase 0 Product Order

```text
P0-CMD-001 -> P0-LIVE-001 -> P0-INV-001 -> P0-BATCH-001 -> P0-RATE-001
```

`P0-EXEC-001` governs agent execution and review hygiene. It does not reorder product work.

## 5. Command and Outbox Authority Boundary

All mutations use the command layer. A successful edit must atomically create or update:

```text
command_log
current-state business row(s)
audit_events
domain_events
outbox_events
terminal command status
```

For MVP, `PostgresMvpNumericLedgerAdapter` participates in the same PostgreSQL transaction when numeric movement scaffolding is touched. Post-MVP TigerBeetle calls remain outside Phase 0 edit-path scope and are described only as a future adapter boundary.

## 6. External Integration Boundary

Inbound external payloads may enter staging, but they cannot create command proposals until all required checks pass:

```text
authentication
rate limit
content-type allow-list
payload byte limit
payload hash
malware scan
schema validation
classification/redaction
service-account scope
credential state
external mapping rule
```

Outbound integration delivery originates only from durable outbox events. External systems never write operational tables or TigerBeetle directly.

## 7. Derived Plane Boundary

Post-MVP specialized planes remain derived, evidence-gated, and non-authoritative in Phase 0:

| Plane | Phase 0 status | Post-MVP role |
|---|---|---|
| TigerBeetle | Adapter scaffolding only; no runtime dependency in edit path. | Conserved numeric ledger plane after P1-LEDGER evidence. |
| pgvector | Schema/readiness concepts only. | Permissioned semantic retrieval over revalidated chunks. |
| DuckDB | Export/readiness concepts only. | Derived analytics over governed snapshots. |
| CDC/broker fan-out | Envelope/readiness concepts only. | Outbox fan-out after P1-OUTBOX evidence. |
| External integrations | Staging contract and synthetic fixtures only. | Governed adapters after P1-INTEGRATION evidence. |
| Tiled UI | Metadata hooks and command-safe transpose only. | Tiled workspace after vertical slice and P1-UX evidence. |

Detailed post-MVP design lives in:

```text
docs/post-mvp/post-mvp-planes-vnext.md
```

## 8. AI Coding-Agent Execution Model

Agents execute one work order per PR by default. Required first reads:

```text
docs/snapshot-v0.15.2.md
AGENTS.md
docs/implementation/phase0-agent-work-orders.md
```

Agents must:

```text
- respect allowed path boundaries;
- start from skeletons where available;
- run validation before handoff;
- provide evidence URI mapping;
- stop on authority-boundary ambiguity;
- not invent schema, ID, event, permission, or command semantics.
```

## 9. Validation and Waiver Policy

Default validation remains strict:

```bash
bash scripts/validate-pack.sh
```

A non-release-blocking documentation check may be run in waiver mode only with an entry in:

```text
docs/process/decision-waiver-log.md
```

```bash
bash scripts/validate-pack.sh --waiver DOC-WAIVER-YYYYMMDD-XXX
```

Release blockers remain non-waivable, including command/outbox authority, invariant presence, active-spec uniqueness, duplicate IDs, DDL centralization, manifest evidence wiring, secret/plaintext bypass, and Phase 0 post-MVP runtime admission.

## 10. UI Scope Guard

The grid remains the MVP UI anchor. Minimal transposed/detail surfaces may be used only when they:

```text
- preserve canonical field identity;
- use the same command API as grid edits;
- do not introduce tile layout machinery into the vertical slice;
- do not delay P0-CMD-001 or P0-LIVE-001.
```

`UI-008` blocks any tile or transposed view from carrying a mutation path that bypasses `command_api` before P1-UX-001 is green.

## 11. Required Skeletons and PR Examples

Agents should start from these reference skeletons when implementing corresponding work orders:

```text
docs/skeletons/CommandHandlerBase.ts
docs/skeletons/OutboxPoller.ts
docs/skeletons/NumericLedgerPort.ts
docs/skeletons/RetrievalRevalidator.middleware.ts
```

Concrete good/bad PR handoff examples live in:

```text
docs/implementation/pr-handoff-examples.md
```

## 12. Phase 0 Definition of Done

Phase 0 is complete only when:

```text
1. Single safe cell edit persists command_log, current-state change, audit_event, domain_event, and outbox_event.
2. Unknown-outcome recovery passes TC-CMD-001.
3. Outbox polling delivers live updates without NOTIFY.
4. NOTIFY benchmark either passes and is admitted, or remains disabled.
5. Security invariant manifest runs in CI.
6. Transactional-batch policy compiler fails closed on hidden dependencies.
7. Hot-path edit rate limiting does not write PostgreSQL counters synchronously.
8. Minimal UI edit path routes grid and any allowed detail/transpose edits through command_api.
9. Agent-authored PRs pass P0-EXEC-001 and include evidence handoff.
10. Compliance owner signs readiness or blocks regulated pilot data.
```

## 13. Canonical Sources

| Area | Canonical source |
|---|---|
| First-read architecture snapshot | `docs/snapshot-v0.15.2.md` |
| Agent instructions | `AGENTS.md` |
| Agent roadmap | `docs/implementation/ai-coding-agent-roadmap.md` |
| Phase 0 work orders | `docs/implementation/phase0-agent-work-orders.md` |
| Agent PR examples | `docs/implementation/pr-handoff-examples.md` |
| Agent simulation output | `docs/qa/agent-simulation-output-v0.15.2.md` |
| Command lifecycle | `docs/dev/command-lifecycle.md` |
| Command/outbox schema | `docs/data/command-outbox-retention-partitioning.md` |
| Outbox polling performance | `docs/data/outbox-polling-performance-contract.md` |
| Numeric ledger contract | `docs/data/numeric-ledger-contract.md` |
| Ledger ID derivation | `docs/data/ledger-id-derivation-reference.md` |
| Integration contract | `docs/data/external-integration-contract.md` |
| Credential boundary | `docs/security/integration-credential-management.md` |
| UI tile/transpose strategy | `docs/ui/spreadsheet-tiled-workspace-strategy.md` |
| Post-MVP plane details | `docs/post-mvp/post-mvp-planes-vnext.md` |
| Tech-stack snapshot | `docs/tech-stack-decisions.md` |
| Invariants | `invariants/security-invariants.yml` |
| Test manifest | `tests/manifest.yml` |
| SLOs | `docs/slo-baseline.yml` |
| Validation | `scripts/validate-pack.sh` |

## 14. Final v0.15.2 Recommendation

Proceed with Phase 0 implementation using the v0.15.2 agent work-order catalog. The first sprint should implement repository bootstrap, command identity, outbox polling scaffolding, invariant CI, and a minimal command-safe spreadsheet edit path.

Do not optimize for breadth. Optimize for one provably safe mutation with durable recovery and observable replay.
