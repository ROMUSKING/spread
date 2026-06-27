import type {
  SubmitCommandRequest,
  SubmitCommandResponse,
  CommandStatusResponse,
} from '@erp/contracts/command-api';
import { CommandProcessor } from '../commands/CommandProcessor';
import type { Queryable } from '@erp/db/transaction';

let globalProcessor: CommandProcessor | null = null;

export function initCommandRoute(
  db: Queryable,
  handlers: Map<string, any>,
): void {
  globalProcessor = new CommandProcessor(db, handlers);
}

export function getCommandProcessor(): CommandProcessor {
  if (!globalProcessor) {
    throw new Error(
      'Command route not initialized. Call initCommandRoute first.',
    );
  }
  return globalProcessor;
}

export async function submitCommand(
  tenantId: string,
  userId: string,
  request: SubmitCommandRequest,
  traceparent?: string | null,
  correlationId?: string | null,
  workbookId?: string | null,
): Promise<SubmitCommandResponse> {
  const processor = getCommandProcessor();
  return processor.processCommand(
    tenantId,
    userId,
    request,
    traceparent,
    correlationId,
    workbookId,
  );
}

export async function getCommandStatusRoute(
  tenantId: string,
  commandId: string,
  workbookId?: string | null,
): Promise<CommandStatusResponse | null> {
  const processor = getCommandProcessor();
  // wb threaded for validation/ambiguity context (processor may assert match)
  return processor.getCommandStatus(tenantId, commandId, workbookId);
}

export async function submitCommandStub(
  request: SubmitCommandRequest,
): Promise<SubmitCommandResponse> {
  // Retained stub signature for backwards compatibility with validation scripts
  return { commandId: request.commandId, status: 'received' };
}
