import type { SubmitCommandRequest, SubmitCommandResponse, CommandStatusResponse } from "@erp/contracts/command-api";
import { CommandProcessor } from "../commands/CommandProcessor";
import type { Queryable } from "@erp/db/transaction";

let globalProcessor: CommandProcessor | null = null;

export function initCommandRoute(db: Queryable, handlers: Map<string, any>): void {
  globalProcessor = new CommandProcessor(db, handlers);
}

export function getCommandProcessor(): CommandProcessor {
  if (!globalProcessor) {
    throw new Error("Command route not initialized. Call initCommandRoute first.");
  }
  return globalProcessor;
}

export async function submitCommand(tenantId: string, userId: string, request: SubmitCommandRequest): Promise<SubmitCommandResponse> {
  const processor = getCommandProcessor();
  return processor.processCommand(tenantId, userId, request);
}

export async function getCommandStatusRoute(tenantId: string, commandId: string): Promise<CommandStatusResponse | null> {
  const processor = getCommandProcessor();
  return processor.getCommandStatus(tenantId, commandId);
}

export async function submitCommandStub(request: SubmitCommandRequest): Promise<SubmitCommandResponse> {
  // Retained stub signature for backwards compatibility with validation scripts
  return { commandId: request.commandId, status: "received" };
}
