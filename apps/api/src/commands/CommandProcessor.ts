import crypto from "crypto";
import type { CommandEnvelope, CommandOutcome } from "@erp/domain/commands/types";
import { PostgresMvpNumericLedgerAdapter } from "@erp/domain/ledger/NumericLedgerPort";
import type { Queryable, TransactionClient } from "@erp/db/transaction";
import { withTransaction } from "@erp/db/transaction";
import type { SubmitCommandRequest, SubmitCommandResponse, CommandStatusResponse } from "@erp/contracts/command-api";

// Simple stub implementations for metrics and tracing
const stubTracer = {
  startSpan: (name: string, attrs: any) => ({
    recordException: (err: any) => console.error(err),
    end: () => {}
  })
};

const stubMetrics = {
  increment: (name: string, tags: any) => {},
  observe: (name: string, val: number) => {}
};

export class CommandProcessor {
  constructor(
    private readonly db: Queryable,
    private readonly handlers: Map<string, any>
  ) {}

  /**
   * Helper to calculate payload hash for idempotency and privacy
   */
  calculateHash(payload: unknown): string {
    const serialized = JSON.stringify(payload ?? {});
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Boundary A + B Command Execution Pipeline
   */
  async processCommand(tenantId: string, userId: string, request: SubmitCommandRequest): Promise<SubmitCommandResponse> {
    const { commandId, commandType, payload } = request;
    const requestHash = request.requestHash || this.calculateHash(payload);
    const requestBodyHash = this.calculateHash(payload);

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
          return {
            commandId,
            status: "failed",
            problem: {
              code: "COMMAND_ID_REUSE_CONFLICT",
              message: "Command ID reuse conflict: different request hash detected."
            }
          };
        }

        // Check for duplicate pending requests
        if (existing.command_status === "received" || existing.command_status === "pending") {
          return {
            commandId,
            status: "pending",
            problem: {
              code: "COMMAND_PENDING",
              message: "Command is currently executing in-flight."
            }
          };
        }

        // Return cached terminal outcome
        return {
          commandId,
          status: existing.command_status,
          body: existing.response_body_redacted
        };
      }

      // Claim command ID: Insert pending row
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 day TTL
      const insertClaimSql = `
        INSERT INTO command_log (
          tenant_id, command_id, trace_id, correlation_id, user_id,
          command_type, command_status, request_hash, request_body_hash,
          expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      `;
      await this.db.query(insertClaimSql, [
        tenantId,
        commandId,
        "trace-id-stub",
        "correlation-id-stub",
        userId,
        commandType,
        "pending",
        requestHash,
        requestBodyHash,
        expiresAt
      ]);
    } catch (err) {
      return {
        commandId,
        status: "failed",
        problem: {
          code: "COMMAND_CLAIM_FAILED",
          message: err instanceof Error ? err.message : String(err)
        }
      };
    }

    // 2. Locate command handler
    const handler = this.handlers.get(commandType);
    if (!handler) {
      const errorMsg = `Handler not found for command type: ${commandType}`;
      await this.updateCommandStatus(tenantId, commandId, "failed", {
        code: "HANDLER_NOT_FOUND",
        message: errorMsg
      });
      return {
        commandId,
        status: "failed",
        problem: { code: "HANDLER_NOT_FOUND", message: errorMsg }
      };
    }

    // 3. Boundary B: Run execution inside business transaction
    const envelope: CommandEnvelope = {
      tenantId,
      commandId,
      requestHash,
      commandType,
      userId,
      traceId: "trace-id-stub",
      correlationId: "correlation-id-stub",
      payload
    };

    try {
      const outcome = await withTransaction(this.db, async (tx: TransactionClient) => {
        const ledger = new PostgresMvpNumericLedgerAdapter(tenantId, tx);
        const context = {
          tx,
          ledger,
          tracer: stubTracer,
          metrics: stubMetrics
        };
        // Execute the handler business logic
        const result = await handler.execute(envelope, context);
        return result;
      });

      // Update command log to committed or rejected/failed based on outcome
      if (outcome.status === "committed") {
        const responseData = outcome.response ?? {};
        await this.updateCommandStatus(tenantId, commandId, "committed", responseData);
        return {
          commandId,
          status: "committed",
          body: responseData
        };
      } else {
        const problemData = { code: outcome.code, message: outcome.message };
        const status = outcome.status === "rejected" ? "rejected" : "failed";
        await this.updateCommandStatus(tenantId, commandId, status, problemData);
        return {
          commandId,
          status,
          problem: problemData
        };
      }
    } catch (err) {
      // Transaction was rolled back. Update command_log to failed.
      const problemData = {
        code: "COMMAND_EXECUTION_FAILED",
        message: err instanceof Error ? err.message : String(err)
      };
      await this.updateCommandStatus(tenantId, commandId, "failed", problemData);
      return {
        commandId,
        status: "failed",
        problem: problemData
      };
    }
  }

  /**
   * Status updates for command log
   */
  private async updateCommandStatus(tenantId: string, commandId: string, status: string, responseOrError: any): Promise<void> {
    try {
      const updateSql = `
        UPDATE command_log
        SET command_status = $3,
            response_body_redacted = $4,
            committed_at = CASE WHEN $3 = 'committed' THEN now() ELSE committed_at END
        WHERE tenant_id = $1 AND command_id = $2
      `;
      await this.db.query(updateSql, [
        tenantId,
        commandId,
        status,
        JSON.stringify(responseOrError)
      ]);
    } catch (err) {
      console.error(`Failed to update command status for ${commandId}:`, err);
    }
  }

  /**
   * Retrieves command status, performing ambiguity resolution if needed
   */
  async getCommandStatus(tenantId: string, commandId: string): Promise<CommandStatusResponse | null> {
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
    if ((status === "received" || status === "pending") && new Date() > new Date(record.expires_at)) {
      // Query if any outbox events exist matching the command_id
      const outboxSql = "SELECT outbox_id FROM outbox_events WHERE tenant_id = $1 AND command_id = $2 LIMIT 1";
      const outboxRes = await this.db.query<any>(outboxSql, [tenantId, commandId]);
      const outboxRows = outboxRes?.rows || outboxRes || [];

      if (outboxRows.length > 0) {
        status = "committed";
        // Commit the resolved state
        await this.updateCommandStatus(tenantId, commandId, "committed", record.response_body_redacted || {});
      } else {
        status = "ambiguous";
        // Commit the resolved state
        await this.updateCommandStatus(tenantId, commandId, "ambiguous", {
          code: "COMMAND_AMBIGUOUS_EXPIRED",
          message: "Command expired with unknown outcome."
        });
      }
    }

    const statusResponse: CommandStatusResponse = {
      commandId,
      status,
      body: record.response_body_redacted,
      createdAt: new Date(record.created_at).toISOString(),
      expiresAt: new Date(record.expires_at).toISOString()
    };
    if (record.committed_at) {
      statusResponse.committedAt = new Date(record.committed_at).toISOString();
    }
    return statusResponse;
  }
}
