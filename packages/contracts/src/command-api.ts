import type { CommandStatus } from '@erp/domain/commands/types';

export type SubmitCommandRequest<TPayload = unknown> = {
  commandId: string;
  requestHash: string;
  commandType: string;
  payload: TPayload;
  workbookId?: string; // threaded for command_log, current_cell, outbox, demand filter
};

export type SubmitCommandResponse<TBody = unknown> = {
  commandId: string;
  status: CommandStatus;
  body?: TBody | undefined;
  problem?: { code: string; message: string } | undefined;
};

export type CommandStatusResponse<TBody = unknown> =
  SubmitCommandResponse<TBody> & {
    createdAt: string;
    committedAt?: string | undefined;
    expiresAt: string;
  };
