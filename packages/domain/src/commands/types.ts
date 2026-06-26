import type { CommandId, CorrelationId, TenantId, TraceId, UserId, WorkbookId } from "../types/ids";

export type CommandStatus = "received" | "pending" | "committed" | "rejected" | "failed" | "ambiguous";

export type CommandEnvelope<TPayload = unknown> = {
  tenantId: TenantId;
  commandId: CommandId;
  requestHash: string;
  commandType: string;
  userId: UserId;
  workbookId?: WorkbookId;
  traceId: TraceId;
  correlationId: CorrelationId;
  payload: TPayload;
};

export type CommandOutcome<TResponse = unknown> =
  | { status: "committed"; response: TResponse }
  | { status: "rejected"; code: string; message: string }
  | { status: "failed"; code: string; message: string };
