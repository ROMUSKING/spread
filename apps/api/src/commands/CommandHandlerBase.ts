import type {
  CommandEnvelope,
  CommandOutcome,
} from '@erp/domain/commands/types';
import type { NumericLedgerPort } from '@erp/domain/ledger/NumericLedgerPort';
import type { MetricsLike } from '@erp/observability/metrics';
import type { TracerLike } from '@erp/observability/tracing';

export type CommandExecutionContext = {
  tx: { query: (sql: string, params?: readonly unknown[]) => Promise<unknown> };
  ledger: NumericLedgerPort;
  tracer: TracerLike;
  metrics: MetricsLike;
};

export abstract class CommandHandlerBase<TPayload, TResponse> {
  abstract readonly commandType: string;

  async execute(
    envelope: CommandEnvelope<TPayload>,
    context: CommandExecutionContext,
  ): Promise<CommandOutcome<TResponse>> {
    const span = context.tracer.startSpan('command.execute', {
      'command.type': envelope.commandType,
      'command.id': envelope.commandId,
      'tenant.id': envelope.tenantId,
    });

    try {
      this.assertEnvelope(envelope);
      const result = await this.executeBusinessLogic(envelope, context);
      context.metrics.increment('command_committed_total', {
        command_type: envelope.commandType,
      });
      return { status: 'committed', response: result };
    } catch (error) {
      span.recordException(error);
      context.metrics.increment('command_failed_total', {
        command_type: envelope.commandType,
      });
      return {
        status: 'failed',
        code: 'COMMAND_EXECUTION_FAILED',
        message:
          error instanceof Error ? error.message : 'Unknown command failure',
      };
    } finally {
      span.end();
    }
  }

  protected assertEnvelope(envelope: CommandEnvelope<TPayload>): void {
    if (
      !envelope.commandId ||
      !envelope.requestHash ||
      !envelope.tenantId ||
      !envelope.workbookId
    ) {
      throw new Error(
        'ASSERT_FAILED: Invalid command envelope: commandId, requestHash, tenantId, workbookId required.',
      );
    }
  }

  protected abstract executeBusinessLogic(
    envelope: CommandEnvelope<TPayload>,
    context: CommandExecutionContext,
  ): Promise<TResponse>;
}
