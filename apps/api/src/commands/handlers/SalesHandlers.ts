import type { CommandEnvelope } from '@erp/domain/commands/types';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

// Stub for sales domain commands (flattened lines per spec recommendation)
// Basic create writes cells; full allocate/fulfill would also touch inventory + ledger.

export type SalesOrderCreatePayload = {
  orderId: string;
  customerId: string;
  lines: Array<{
    lineId?: string;
    productId: string;
    qty: number;
    unit_price: string;
  }>;
  status?: string;
};

export class SalesOrderCreateHandler extends CommandHandlerBase<
  SalesOrderCreatePayload,
  { orderId: string; linesWritten: number }
> {
  readonly commandType = 'salesOrder.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<SalesOrderCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ orderId: string; linesWritten: number }> {
    const { orderId, customerId, lines, status = 'DRAFT' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000015';

    if (!orderId || !lines || lines.length === 0) {
      throw new Error('ASSERT_FAILED: orderId and at least one line required');
    }

    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lineId = line.lineId || `${i + 1}`;
      const rowId = `${orderId}-L${lineId}`;

      const cells = [
        ['order_id', orderId],
        ['line_id', lineId],
        ['product_id', line.productId],
        ['qty', String(line.qty)],
        ['unit_price', line.unit_price],
        ['customer_id', customerId || ''],
        ['status', status],
        ['line_total', String((parseFloat(line.unit_price) || 0) * (line.qty || 0))],
      ];

      for (const [col, val] of cells) {
        await context.tx.query(
          `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
           DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
          [tenant, workbookId, rowId, col, String(val)]
        );
      }
      count++;
    }

    // Write a HDR row for order level (flattened model)
    const hdrRow = `${orderId}-HDR`;
    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, workbookId, hdrRow, 'order_id', orderId]
    );
    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, workbookId, hdrRow, 'status', status]
    );

    return { orderId, linesWritten: count };
  }
}
