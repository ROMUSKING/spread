# Agent PR Handoff Examples

**Version:** 0.17.0  
**Status:** Active examples for reviewers and AI coding agents  
**Purpose:** Show what an acceptable agent PR handoff looks like and what must be rejected.

## Good handoff example — AGENT-010 command log schema

```markdown
## Work order
- ID: AGENT-010
- Gate: P0-CMD-001
- Dependencies merged: AGENT-000, AGENT-001

## Summary
Adds command_log migration and command-id reuse conflict test. Does not expose editable cells yet.

## Canonical docs read
- docs/snapshot-v0.18.0.md
- docs/dev/command-lifecycle.md
- docs/data/command-outbox-retention-partitioning.md
- apps/api/src/commands/CommandHandlerBase.ts

## Files changed
- packages/db/migrations/0001_command_log.sql
- packages/domain/commands/commandLogRepository.ts
- packages/testkit/commandLog.fixtures.ts

## Evidence
- ci://tests/api/command-id-reuse-conflict
- ci://tests/api/command-status-ttl

## Commands run
```text
bash scripts/validate-pack.sh
npm run typecheck
npm run test:command
```

## Stop-condition check
- [x] No command bypass
- [x] No outbox bypass
- [x] No post-MVP runtime in Phase 0 edit path
- [x] No direct external/TigerBeetle/broker write
- [x] No unrevalidated derived-plane output
- [x] No secret/raw regulated payload storage
```

Representative acceptable diff:

```diff
+ CREATE TABLE command_log (...);
+ CREATE UNIQUE INDEX ux_command_log_tenant_command ON command_log (tenant_id, command_id);
+ it('rejects same commandId with different request hash', async () => { ... });
```

Why this is acceptable:

```text
- It changes only command infrastructure.
- It maps to manifest evidence.
- It does not open a mutation path outside command handlers.
- It stops before UI/editable-cell scope.
```

## Rejected handoff example — outbox bypass

```markdown
## Work order
- ID: AGENT-021
- Gate: P0-LIVE-001

## Summary
Pushes WebSocket/SSE updates directly from the domain handler after updating the workbook row.
```

Representative rejected diff:

```diff
 async function updateCell(command) {
   await db.update(workbook_cells).set(...);
+  sseHub.broadcast({ type: 'cell.updated', workbookId, rowId, colId });
   return { ok: true };
 }
```

Required reviewer response:

```text
Reject. This violates OUTBOX-001, P0-LIVE-001, and the snapshot authority map.
The fix is to emit an outbox_events row inside the command transaction and let the polling reader deliver it.
```

## Rejected handoff example — post-MVP runtime admitted early

```diff
 import { createClient as createTigerBeetleClient } from 'tigerbeetle-node';

 export async function ordinaryCellEdit(command) {
+  await tigerbeetleClient.createTransfers([...]);
   await commandHandler.execute(command);
 }
```

Required reviewer response:

```text
Reject. TigerBeetle is a post-MVP numeric ledger plane. Phase 0 may use NumericLedgerPort scaffolding and PostgresMvpNumericLedgerAdapter only.
```

## Rejected handoff example — validation waiver abuse

```bash
bash scripts/validate-pack.sh --waiver made-up-id
```

Required reviewer response:

```text
Reject. Waiver IDs must exist in docs/process/decision-waiver-log.md and cannot waive release-blocking failures.
```
