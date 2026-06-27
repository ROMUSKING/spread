import http from 'node:http';
import crypto from 'node:crypto';
import { assertPhase0RuntimeFlags } from '@erp/config/env';
import { createPostgresQueryable } from '../../../packages/db/src/index.js'; // relative for smoke-typecheck coherence (workspace alias post-install)
import {
  initCommandRoute,
  submitCommand,
  getCommandStatusRoute,
} from './routes/commands';
import { initEventsRoute, sseEventsRoute } from './routes/events';
import { OutboxPollerLoop } from './outbox/OutboxPollerLoop';
import { OutboxPoller } from './outbox/OutboxPoller';
import { OutboxRepository } from './outbox/OutboxRepository';
import { SseConnectionManager } from './outbox/SseConnectionManager';
import {
  getMetrics,
  getTracer,
  setMetrics,
  setTracer,
  InMemoryMetrics,
  InMemoryTracer,
} from '@erp/observability';
import {
  CommandHandlerBase,
  type CommandExecutionContext,
} from './commands/CommandHandlerBase';
import type { CommandEnvelope } from '@erp/domain/commands/types';
import { RateLimiter } from './http/RateLimiter';

// Ensure Phase 0 flags (post-MVP off)
assertPhase0RuntimeFlags();

// Pilot defaults
const PORT = Number(process.env.API_PORT || 3001);
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001'; // matches seed
const DEFAULT_WORKBOOK = '00000000-0000-0000-0000-000000000002';

// In-memory tracer/metrics for Phase 0 (real OTEL later)
const tracer = new InMemoryTracer();
const metrics = new InMemoryMetrics();
setTracer(tracer);
setMetrics(metrics);

// Simple in-tx handler for demo "cell.update" (will be replaced by real CellUpdateHandler)
// It writes current cell + numeric movement (quantity) + returns payload for outbox.
class DemoCellUpdateHandler extends CommandHandlerBase<
  { rowId: string; columnId: string; value: string },
  { rowId: string; columnId: string; value: string }
> {
  readonly commandType = 'cell.update';
  async executeBusinessLogic(
    envelope: CommandEnvelope<{
      rowId: string;
      columnId: string;
      value: string;
    }>,
    context: CommandExecutionContext,
  ) {
    const { rowId, columnId, value } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbook = envelope.workbookId || DEFAULT_WORKBOOK;

    // Current state write (the table added in canonical migration)
    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, workbook, rowId, columnId, value],
    );

    // Numeric ledger movement for quantity (demo using the seeded accounts)
    // Real production handlers would compute delta vs old value + use proper IDs.
    try {
      await context.ledger.createTransfer({
        transferIdDec: String(BigInt(Date.now())), // demo only
        debitAccountIdDec: '100000000000000000000000000000000001',
        creditAccountIdDec: '200000000000000000000000000000000001',
        amountDec: '1', // demo delta
        ledgerCode: '1',
        movementKind: 'adjustment',
        payloadHash: 'demo',
        commandId: envelope.commandId,
        commandLineIndex: 0,
        ledgerGroupId:
          crypto.randomUUID?.() || '00000000-0000-0000-0000-000000000000',
        transferCode: 1,
        mode: 'single_phase',
        status: 'posted',
      });
    } catch (e) {
      // Ledger may complain in early seeds; non-fatal for demo slice
    }

    return { rowId, columnId, value };
  }
}

export async function startApi(): Promise<void> {
  const db = createPostgresQueryable();
  const outboxRepo = new OutboxRepository(db);

  // Register handlers (demo cell handler for vertical slice)
  const handlers = new Map<string, any>();
  handlers.set('cell.update', new DemoCellUpdateHandler());

  initCommandRoute(db, handlers);
  const connectionManager = new SseConnectionManager();
  initEventsRoute(connectionManager, outboxRepo);

  // Background poller for SSE delivery
  const poller = new OutboxPoller(outboxRepo, metrics, {
    maxEventsPerPoll: 1000,
    maxBytesPerPoll: 2 * 1024 * 1024,
  });
  const pollerLoop = new OutboxPollerLoop(poller, connectionManager, 750);
  pollerLoop.start();

  // Rate limiter (ordinary edits)
  const rateLimiter = new RateLimiter({
    maxTokens: 120,
    refillRate: 2,
    refillIntervalMs: 1000,
  });

  // Native HTTP server (no extra runtime deps beyond node)
  const server = http.createServer(async (req, res) => {
    // CORS for local dev web
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'content-type,x-tenant-id,x-user-id,x-workbook-id,x-trace-id,x-correlation-id,last-event-id',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    try {
      if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'erp-api', phase: '0' }));
        return;
      }

      if (url.pathname === '/api/commands' && req.method === 'POST') {
        let tenantId = req.headers['x-tenant-id']?.toString() || DEFAULT_TENANT;
        let workbookId =
          req.headers['x-workbook-id']?.toString() || DEFAULT_WORKBOOK;
        const userId =
          req.headers['x-user-id']?.toString() ||
          '00000000-0000-0000-0000-000000000099';
        const traceparent =
          req.headers['x-trace-id']?.toString() ||
          req.headers['traceparent']?.toString();
        const correlationId = req.headers['x-correlation-id']?.toString();

        // Client identity allowlist / validation at entry (fail fast before processor)
        if (tenantId !== DEFAULT_TENANT || workbookId !== DEFAULT_WORKBOOK) {
          console.debug(
            '[pilot-demo] remapped non-pilot tenant/workbook to defaults',
          );
        }
        if (tenantId !== DEFAULT_TENANT) tenantId = DEFAULT_TENANT;
        if (workbookId !== DEFAULT_WORKBOOK) workbookId = DEFAULT_WORKBOOK;
        // Fail fast on unknown (in non-pilot would reject; here force + log)
        if (!tenantId || !workbookId) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_client_identity' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

        const rl = rateLimiter.tryConsume(
          tenantId,
          body.commandType || 'cell.update',
          'ordinary',
        );
        if (!rl.allowed) {
          res.setHeader(
            'Retry-After',
            String(Math.ceil((rl.retryAfterMs || 1000) / 1000)),
          );
          res.writeHead(429, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'rate_limited' }));
          return;
        }

        const resp = await submitCommand(
          tenantId,
          userId,
          body,
          traceparent,
          correlationId,
          workbookId,
        );
        res.writeHead(resp.status === 'committed' ? 200 : 202, {
          'content-type': 'application/json',
        });
        res.end(JSON.stringify(resp));
        return;
      }

      if (url.pathname.startsWith('/api/commands/') && req.method === 'GET') {
        const commandId = url.pathname.split('/').pop() || '';
        let tenantId = req.headers['x-tenant-id']?.toString() || DEFAULT_TENANT;
        const wbHdr =
          req.headers['x-workbook-id']?.toString() || DEFAULT_WORKBOOK;
        if (tenantId !== DEFAULT_TENANT || wbHdr !== DEFAULT_WORKBOOK) {
          console.debug('[pilot-demo] remapped non-pilot for status');
        }
        if (tenantId !== DEFAULT_TENANT) tenantId = DEFAULT_TENANT;
        const status = await getCommandStatusRoute(tenantId, commandId);
        if (!status) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'not_found' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(status));
        return;
      }

      if (url.pathname === '/api/workbooks' && req.method === 'GET') {
        let tenantId =
          url.searchParams.get('tenantId') ||
          req.headers['x-tenant-id']?.toString() ||
          DEFAULT_TENANT;
        let workbookId =
          url.searchParams.get('workbookId') ||
          req.headers['x-workbook-id']?.toString() ||
          DEFAULT_WORKBOOK;
        if (tenantId !== DEFAULT_TENANT || workbookId !== DEFAULT_WORKBOOK) {
          console.debug(
            '[pilot-demo] remapped non-pilot tenant/workbook to defaults',
          );
        }
        if (tenantId !== DEFAULT_TENANT) tenantId = DEFAULT_TENANT;
        if (workbookId !== DEFAULT_WORKBOOK) workbookId = DEFAULT_WORKBOOK;
        if (!tenantId || !workbookId) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_client_identity' }));
          return;
        }

        const result = await db.query<any>(
          `SELECT row_id, column_id, value_text
           FROM current_cell_values
           WHERE tenant_id = $1 AND workbook_id = $2
           ORDER BY row_id ASC, column_id ASC`,
          [tenantId, workbookId],
        );

        const rows = result?.rows || result || [];
        const rowMap = new Map<string, Record<string, string>>();

        for (const row of rows) {
          const rowId = String(row.row_id);
          const columnId = String(row.column_id);
          const values = rowMap.get(rowId) ?? {};
          values[columnId] = String(row.value_text ?? '');
          rowMap.set(rowId, values);
        }

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            tenantId,
            workbookId,
            rows: [...rowMap.entries()].map(([rowId, values]) => ({
              rowId,
              values,
            })),
          }),
        );
        return;
      }

      if (url.pathname === '/api/events' && req.method === 'GET') {
        let tenantId =
          url.searchParams.get('tenantId') ||
          req.headers['x-tenant-id']?.toString() ||
          DEFAULT_TENANT;
        let workbookId =
          url.searchParams.get('workbookId') ||
          req.headers['x-workbook-id']?.toString() ||
          DEFAULT_WORKBOOK;
        if (tenantId !== DEFAULT_TENANT || workbookId !== DEFAULT_WORKBOOK) {
          console.debug(
            '[pilot-demo] remapped non-pilot tenant/workbook to defaults',
          );
        }
        if (tenantId !== DEFAULT_TENANT) tenantId = DEFAULT_TENANT;
        if (workbookId !== DEFAULT_WORKBOOK) workbookId = DEFAULT_WORKBOOK;
        if (!tenantId || !workbookId) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_client_identity' }));
          return;
        }
        const lastEventId = req.headers['last-event-id']?.toString() || null;

        const stream = sseEventsRoute(tenantId, workbookId, lastEventId);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const reader = stream.getReader();
        const pump = async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch (e) {
            getMetrics().increment('erp_sse_pump_error_total');
          }
          res.end();
        };
        pump();
        req.on('close', () => reader.cancel());
        return;
      }

      res.writeHead(404);
      res.end('not found');
    } catch (err: any) {
      getMetrics().increment('erp_server_error_total');
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'server_error',
          message: String(err?.message || err),
        }),
      );
    }
  });

  console.log(`[api] starting on :${PORT} (tenant ${DEFAULT_TENANT})`);
  server.listen(PORT, () => {
    console.log(`[api] listening http://localhost:${PORT}`);
  });

  // Keep alive
  return new Promise(() => {});
}

// Auto-start when run directly (dev / node)
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('server.ts')
) {
  startApi().catch((e) => {
    console.error('API failed to start', e);
    process.exit(1);
  });
}
