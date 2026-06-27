import crypto from 'crypto';
import type {
  CommandEnvelope,
  CommandOutcome,
} from '@erp/domain/commands/types';
import { PostgresMvpNumericLedgerAdapter } from '@erp/domain/ledger/NumericLedgerPort';
import type { Queryable, TransactionClient } from '@erp/db/transaction';
import { withTransaction } from '@erp/db/transaction';
import type {
  SubmitCommandRequest,
  SubmitCommandResponse,
  CommandStatusResponse,
} from '@erp/contracts/command-api';
import type { InsertOutboxEventParams } from '@erp/contracts/events';
import {
  OutboxRepository,
  generateDeterministicEventId,
  generateIdempotencyKey,
  serializeOutboxPayload,
} from '../outbox/OutboxRepository.js';
import {
  getTracer,
  getMetrics,
  parseOrGenerateTraceContext,
} from '@erp/observability';

function hashId(id?: string): string {
  if (!id) return '';
  return crypto.createHash('sha256').update(id).digest('hex').slice(0, 12);
}

export class CommandProcessor {
  private readonly db: Queryable;
  private readonly handlers: Map<string, any>;
  private readonly outboxRepo: OutboxRepository;

  constructor(db: Queryable, handlers: Map<string, any>) {
    if (!db) throw new Error('ASSERT_FAILED: CommandProcessor requires db');
    if (!handlers)
      throw new Error('ASSERT_FAILED: CommandProcessor requires handlers');
    this.db = db;
    this.handlers = handlers;
    this.outboxRepo = new OutboxRepository(db);
  }

  /**
   * Helper to calculate payload hash for idempotency and privacy
   */
  calculateHash(payload: unknown): string {
    const serialized = JSON.stringify(payload ?? {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Boundary A + B Command Execution Pipeline
   *
   * Boundary A: Claim and idempotency check (outside business transaction)
   * Boundary B: Business logic + outbox insert (single PostgreSQL transaction)
   *
   * The outbox event is inserted within the same transaction as the command
   * status update, ensuring AUD-001 correlation invariant.
   *
   * @see docs/dev/command-lifecycle.md
   * @see invariants/sql/aud-001-command-audit-domain-outbox-correlation.sql
   */
  async processCommand(
    tenantId: string,
    userId: string,
    request: SubmitCommandRequest,
    traceparent?: string | null,
    correlationId?: string | null,
    workbookId?: string | null,
  ): Promise<SubmitCommandResponse> {
    const { commandId, commandType, payload } = request;
    const wbId = workbookId || (request as any).workbookId || undefined;
    if (!commandId || !commandType || payload === undefined) {
      throw new Error(
        'ASSERT_FAILED: missing required commandId/commandType/payload',
      );
    }
    if (!wbId) {
      throw new Error(
        'ASSERT_FAILED: workbookId required for threading to command_log/outbox/current_cell',
      );
    }
    const requestHash = request.requestHash || this.calculateHash(payload);
    const requestBodyHash = this.calculateHash(payload);

    const traceparentHeader =
      traceparent || (request as any).traceparent || (request as any).traceId;
    const { traceId } = parseOrGenerateTraceContext(traceparentHeader);
    const corrId =
      correlationId ||
      (request as any).correlationId ||
      `corr_${crypto.randomBytes(8).toString('hex')}`;

    const tracer = getTracer();
    const metrics = getMetrics();
    const startTime = Date.now();
    let finalStatus = 'pending';
    const riskClass =
      (this.handlers.get(commandType) as any)?.riskClass || 'ordinary';

    const receiveSpan = tracer.startSpan('erp.command.receive', {
      'erp.tenant_hash': hashId(tenantId),
      'erp.command_id': commandId,
      'erp.command_type': commandType,
      'erp.trace_id': traceId,
      'erp.correlation_id': corrId,
      tenant_id_hash: hashId(tenantId),
      command_id: commandId,
      command_type: commandType,
      trace_id: traceId,
      correlation_id: corrId,
    });

    const claimSpan = tracer.startSpan('erp.command.claim');

    // 1. Boundary A: Claim and Idempotency Check
    try {
      const checkSql = `
        SELECT command_status, request_hash, response_body_redacted
        FROM command_log
        WHERE tenant_id = $1 AND command_id = $2
      `;
      const res = await this.db.query<any>(checkSql, [tenantId, commandId]);
      const rows = res?.rows || res || [];

      if (rows.length > 0) {
        const existing = rows[0];

        // Check for ID reuse with different request hash
        if (existing.request_hash !== requestHash) {
          claimSpan.setAttribute(
            'erp.command_claim_result',
            'conflict_different_hash',
          );
          claimSpan.setAttribute('erp.request_hash_match', false);
          claimSpan.setAttribute('erp.duplicate_inflight', false);
          claimSpan.setAttribute(
            'command_claim_result',
            'conflict_different_hash',
          );
          claimSpan.setAttribute('request_hash_match', false);
          claimSpan.setAttribute('duplicate_inflight', false);

          finalStatus = 'failed';
          claimSpan.end();
          receiveSpan.end();

          return {
            commandId,
            status: 'failed',
            problem: {
              code: 'COMMAND_ID_REUSE_CONFLICT',
              message:
                'Command ID reuse conflict: different request hash detected.',
            },
          };
        }

        // Check for duplicate pending requests
        if (
          existing.command_status === 'received' ||
          existing.command_status === 'pending'
        ) {
          claimSpan.setAttribute(
            'erp.command_claim_result',
            'pending_same_hash',
          );
          claimSpan.setAttribute('erp.request_hash_match', true);
          claimSpan.setAttribute('erp.duplicate_inflight', true);
          claimSpan.setAttribute('command_claim_result', 'pending_same_hash');
          claimSpan.setAttribute('request_hash_match', true);
          claimSpan.setAttribute('duplicate_inflight', true);

          metrics.increment('erp_command_duplicate_inflight_total', {
            command_type: commandType,
          });

          finalStatus = 'pending';
          claimSpan.end();
          receiveSpan.end();

          return {
            commandId,
            status: 'pending',
            problem: {
              code: 'COMMAND_PENDING',
              message: 'Command is currently executing in-flight.',
            },
          };
        }

        // Return cached terminal outcome
        claimSpan.setAttribute(
          'erp.command_claim_result',
          'terminal_same_hash',
        );
        claimSpan.setAttribute('erp.request_hash_match', true);
        claimSpan.setAttribute('erp.duplicate_inflight', false);
        claimSpan.setAttribute('command_claim_result', 'terminal_same_hash');
        claimSpan.setAttribute('request_hash_match', true);
        claimSpan.setAttribute('duplicate_inflight', false);

        finalStatus = existing.command_status;
        claimSpan.end();
        receiveSpan.end();

        return {
          commandId,
          status: existing.command_status,
          body: existing.response_body_redacted,
        };
      }

      // Claim command ID: Insert pending row
      claimSpan.setAttribute('erp.command_claim_result', 'claimed');
      claimSpan.setAttribute('erp.request_hash_match', false);
      claimSpan.setAttribute('erp.duplicate_inflight', false);
      claimSpan.setAttribute('command_claim_result', 'claimed');
      claimSpan.setAttribute('request_hash_match', false);
      claimSpan.setAttribute('duplicate_inflight', false);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 day TTL
      const insertClaimSql = `
        INSERT INTO command_log (
          tenant_id, command_id, trace_id, correlation_id, user_id,
          workbook_id, command_type, command_status, request_hash, request_body_hash,
          expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
      `;
      await this.db.query(insertClaimSql, [
        tenantId,
        commandId,
        traceId,
        corrId,
        userId,
        wbId,
        commandType,
        'pending',
        requestHash,
        requestBodyHash,
        expiresAt,
      ]);
    } catch (err) {
      claimSpan.recordException(err);
      claimSpan.end();
      receiveSpan.end();

      metrics.increment('erp_command_status_total', {
        status: 'failed',
        command_type: commandType,
      });
      return {
        commandId,
        status: 'failed',
        problem: {
          code: 'COMMAND_CLAIM_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    } finally {
      if (claimSpan) {
        claimSpan.end();
      }
    }

    // 2. Locate command handler
    const handler = this.handlers.get(commandType);
    if (!handler) {
      const errorMsg = `Handler not found for command type: ${commandType}`;
      try {
        await withTransaction(this.db, async (rtx) => {
          await this.updateCommandStatus(
            tenantId,
            commandId,
            'failed',
            { code: 'HANDLER_NOT_FOUND', message: errorMsg },
            rtx,
          );
        });
      } catch (e) {
        metrics.increment('erp_privacy_redaction_failures_total', {
          command_type: commandType,
        });
        console.error(
          `Handler not found status update failed ${commandId}:`,
          e,
        );
      }
      receiveSpan.end();
      metrics.increment('erp_command_status_total', {
        status: 'failed',
        command_type: commandType,
      });
      return {
        commandId,
        status: 'failed',
        problem: { code: 'HANDLER_NOT_FOUND', message: errorMsg },
      };
    }

    // 3. Boundary B: Run execution inside business transaction
    //    Single transaction includes: handler logic + ledger + outbox + command status
    const envelope: CommandEnvelope = {
      tenantId,
      commandId,
      requestHash,
      commandType,
      userId,
      workbookId: wbId,
      traceId,
      correlationId: corrId,
      payload,
    };
    if (
      !envelope.tenantId ||
      !envelope.commandId ||
      !envelope.requestHash ||
      !envelope.workbookId
    ) {
      throw new Error(
        'ASSERT_FAILED: envelope missing tenant/command/requestHash/workbookId before tx',
      );
    }

    const executeSpan = tracer.startSpan('erp.command.execute', {
      command_type: commandType,
      workbook_id_hash: hashId(envelope.workbookId),
      risk_class: riskClass,
      trace_id: traceId,
      correlation_id: corrId,
      command_id: commandId,
      tenant_id_hash: hashId(tenantId),
    });

    const txSpan = tracer.startSpan('erp.db.business_tx', {
      'erp.tx.includes_current_state': true,
      'erp.tx.includes_numeric_ledger': true,
      'erp.tx.includes_audit': true,
      'erp.tx.includes_domain_events': true,
      'erp.tx.includes_outbox': true,
    });

    try {
      const outcome = await withTransaction(
        this.db,
        async (tx: TransactionClient) => {
          const ledger = new PostgresMvpNumericLedgerAdapter(tenantId, tx);
          const context = {
            tx,
            ledger,
            tracer,
            metrics,
          };

          // Execute the handler business logic
          const result = await handler.execute(envelope, context);

          // Insert outbox event(s) within the same transaction
          // This ensures AUD-001: every committed command has correlated outbox events
          if (result.status === 'committed') {
            const payloadForOutbox = result.response;
            const payloadJson =
              serializeOutboxPayload(payloadForOutbox) ?? 'null';
            const payloadHash = crypto
              .createHash('sha256')
              .update(payloadJson)
              .digest('hex');
            const commandEventSeq = 1; // First (and currently only) event per command

            const outboxParams: InsertOutboxEventParams = {
              eventId: generateDeterministicEventId(
                tenantId,
                commandId,
                commandEventSeq,
                `${commandType}.committed`,
              ),
              idempotencyKey: generateIdempotencyKey(
                tenantId,
                commandId,
                commandEventSeq,
                `${commandType}.committed`,
              ),
              tenantId,
              workbookId: envelope.workbookId,
              commandId,
              commandEventSeq,
              eventType: `${commandType}.committed`,
              eventSource: 'command-processor',
              eventSubject: commandType,
              routeKey: `${tenantId}:${commandType}`,
              partitionKey: tenantId,
              targetPlanes: ['sse'],
              schemaVersion: 1,
              dataSchema: `urn:erp:${commandType}:v1`,
              payloadContentType: 'application/json',
              payload: payloadForOutbox,
              payloadHash,
              payloadSizeBytes: Buffer.byteLength(payloadJson, 'utf8'),
              visibilityScope: 'tenant',
              dataClassification: 'internal',
              traceId: envelope.traceId,
              correlationId: envelope.correlationId,
            };

            await this.outboxRepo.insertEvent(tx, outboxParams);
          }

          // Status inside tx using tx client (atomic with outbox/ledger/handler; prevents pending after commit)
          const respData2 =
            result.status === 'committed'
              ? (result.response ?? {})
              : { code: result.code, message: result.message };
          const termSt =
            result.status === 'committed'
              ? 'committed'
              : result.status === 'rejected'
                ? 'rejected'
                : 'failed';
          await this.updateCommandStatus(
            tenantId,
            commandId,
            termSt,
            respData2,
            tx,
          );

          return result;
        },
      );

      // Response after successful tx (status written inside)
      if (outcome.status === 'committed') {
        const responseData = outcome.response ?? {};
        finalStatus = 'committed';
        return {
          commandId,
          status: 'committed',
          body: responseData,
        };
      } else {
        const problemData = { code: outcome.code, message: outcome.message };
        const status = outcome.status === 'rejected' ? 'rejected' : 'failed';
        finalStatus = status;
        return {
          commandId,
          status,
          problem: problemData,
        };
      }
    } catch (err) {
      txSpan.recordException(err);
      metrics.increment('erp_command_transaction_boundary_rollback_total', {
        command_type: commandType,
        failure_stage: 'business_tx_failed',
      });

      // Transaction was rolled back. Update command_log to failed (recovery path outside tx)
      const problemData = {
        code: 'COMMAND_EXECUTION_FAILED',
        message: err instanceof Error ? err.message : String(err),
      };
      try {
        await withTransaction(this.db, async (rtx) => {
          await this.updateCommandStatus(
            tenantId,
            commandId,
            'failed',
            problemData,
            rtx,
          );
        });
      } catch (e) {
        metrics.increment('erp_privacy_redaction_failures_total', {
          command_type: commandType,
        });
        console.error(`Post rollback status update failed ${commandId}:`, e);
      }
      finalStatus = 'failed';
      return {
        commandId,
        status: 'failed',
        problem: problemData,
      };
    } finally {
      txSpan.end();
      executeSpan.end();
      receiveSpan.end();

      const duration = Date.now() - startTime;
      metrics.observe('erp_command_duration_ms', duration, {
        command_type: commandType,
        status: finalStatus,
        risk_class: riskClass,
      });
      metrics.increment('erp_command_status_total', {
        status: finalStatus,
        command_type: commandType,
      });
    }
  }

  /**
   * Status updates for command log
   */
  private async updateCommandStatus(
    tenantId: string,
    commandId: string,
    status: string,
    responseOrError: any,
    tx?: {
      query: (sql: string, params?: readonly unknown[]) => Promise<unknown>;
    },
  ): Promise<void> {
    const metrics = getMetrics();
    const serialized = JSON.stringify(responseOrError);
    const client = tx || this.db;
    const updateSql = `
      UPDATE command_log
      SET command_status = $3,
          response_body_redacted = $4,
          committed_at = CASE WHEN $3 = 'committed' THEN now() ELSE committed_at END
      WHERE tenant_id = $1 AND command_id = $2
    `;
    await client.query(updateSql, [tenantId, commandId, status, serialized]);
    // error propagates on fail (tx path rolls back; callers wrap recovery paths)
  }

  /**
   * Retrieves command status, performing ambiguity resolution if needed
   */
  async getCommandStatus(
    tenantId: string,
    commandId: string,
  ): Promise<CommandStatusResponse | null> {
    const checkSql = `
      SELECT command_status, request_hash, response_body_redacted, created_at, committed_at, expires_at
      FROM command_log
      WHERE tenant_id = $1 AND command_id = $2
    `;
    const res = await this.db.query<any>(checkSql, [tenantId, commandId]);
    const rows = res?.rows || res || [];

    if (rows.length === 0) {
      return null;
    }

    const record = rows[0];
    let status = record.command_status;

    // Ambiguity resolution: if command is pending/received but expired, check for outbox events/audit side-effects
    if (
      (status === 'received' || status === 'pending') &&
      new Date() > new Date(record.expires_at)
    ) {
      // Query if any outbox events exist matching the command_id
      const outboxSql =
        'SELECT outbox_id FROM outbox_events WHERE tenant_id = $1 AND command_id = $2 LIMIT 1';
      const outboxRes = await this.db.query<any>(outboxSql, [
        tenantId,
        commandId,
      ]);
      const outboxRows = outboxRes?.rows || outboxRes || [];

      if (outboxRows.length > 0) {
        status = 'committed';
        // Use tx for recovery terminal status to avoid non-terminal (best effort)
        try {
          await withTransaction(this.db, async (rtx) => {
            await this.updateCommandStatus(
              tenantId,
              commandId,
              'committed',
              record.response_body_redacted || {},
              rtx,
            );
          });
        } catch (e) {
          console.error(
            `Ambiguity committed status update failed ${commandId}:`,
            e,
          );
          // response status var remains 'committed' (terminal forced in API result)
        }
      } else {
        status = 'ambiguous';
        try {
          await withTransaction(this.db, async (rtx) => {
            await this.updateCommandStatus(
              tenantId,
              commandId,
              'ambiguous',
              {
                code: 'COMMAND_AMBIGUOUS_EXPIRED',
                message: 'Command expired with unknown outcome.',
              },
              rtx,
            );
          });
        } catch (e) {
          console.error(`Ambiguity status update failed ${commandId}:`, e);
          // terminal 'ambiguous' forced in response
        }
      }
    }

    const statusResponse: CommandStatusResponse = {
      commandId,
      status,
      body: record.response_body_redacted,
      createdAt: new Date(record.created_at).toISOString(),
      expiresAt: new Date(record.expires_at).toISOString(),
    };
    if (record.committed_at) {
      statusResponse.committedAt = new Date(record.committed_at).toISOString();
    }
    return statusResponse;
  }
}
