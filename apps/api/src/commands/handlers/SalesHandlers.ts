import type { CommandEnvelope } from '@erp/domain/commands/types';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

// Stub for sales domain commands (flattened lines per spec recommendation)
// Basic create writes cells; full allocate/fulfill would also touch inventory + ledger.

const SALES_ORDERS_WORKBOOK_ID = '00000000-0000-0000-0000-000000000015';

async function upsertCell(
  tx: CommandExecutionContext['tx'],
  tenantId: string,
  workbookId: string,
  rowId: string,
  columnId: string,
  value: string,
): Promise<void> {
  await tx.query(
    `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
     DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
    [tenantId, workbookId, rowId, columnId, value],
  );
}

async function readCell(
  tx: CommandExecutionContext['tx'],
  tenantId: string,
  workbookId: string,
  rowId: string,
  columnId: string,
): Promise<string | null> {
  const result = await tx.query(
    `SELECT value_text FROM current_cell_values
     WHERE tenant_id = $1 AND workbook_id = $2 AND row_id = $3 AND column_id = $4`,
    [tenantId, workbookId, rowId, columnId],
  );
  const rows = (result as any)?.rows || result || [];
  return rows.length > 0 ? rows[0].value_text || null : null;
}

async function listLineRowIds(
  tx: CommandExecutionContext['tx'],
  tenantId: string,
  workbookId: string,
  rowPattern: string,
): Promise<string[]> {
  const result = await tx.query(
    `SELECT row_id FROM current_cell_values
     WHERE tenant_id = $1 AND workbook_id = $2 AND row_id LIKE $3 AND column_id = 'order_id'`,
    [tenantId, workbookId, rowPattern],
  );
  const rows = (result as any)?.rows || result || [];
  return rows
    .map((row: any) => (typeof row?.row_id === 'string' ? row.row_id : null))
    .filter((rowId: string | null): rowId is string => Boolean(rowId));
}

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
    const workbookId = envelope.workbookId || SALES_ORDERS_WORKBOOK_ID;

    if (!orderId || !lines || lines.length === 0) {
      throw new Error('ASSERT_FAILED: orderId and at least one line required');
    }

    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const lineId = line.lineId || `${i + 1}`;
      const rowId = `${orderId}-L${lineId}`;

      const cells: Array<[string, string]> = [
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
        await upsertCell(context.tx, tenant, workbookId, rowId, col, String(val));
      }
      count++;
    }

    // Write a HDR row for order level (flattened model)
    const hdrRow = `${orderId}-HDR`;
    await upsertCell(context.tx, tenant, workbookId, hdrRow, 'order_id', orderId);
    await upsertCell(context.tx, tenant, workbookId, hdrRow, 'status', status);

    return { orderId, linesWritten: count };
  }
}

export type SalesOrderConfirmPayload = {
  orderId: string;
  lineIds?: string[];
};

export class SalesOrderConfirmHandler extends CommandHandlerBase<
  SalesOrderConfirmPayload,
  { orderId: string; linesConfirmed: number; status: string }
> {
  readonly commandType = 'salesOrder.confirm';

  async executeBusinessLogic(
    envelope: CommandEnvelope<SalesOrderConfirmPayload>,
    context: CommandExecutionContext,
  ): Promise<{ orderId: string; linesConfirmed: number; status: string }> {
    const { orderId, lineIds } = envelope.payload;
    const tenantId = envelope.tenantId;
    const workbookId = envelope.workbookId || SALES_ORDERS_WORKBOOK_ID;

    if (!orderId) {
      throw new Error('ASSERT_FAILED: orderId required');
    }

    const headerRowId = `${orderId}-HDR`;
    const headerOrderId = await readCell(
      context.tx,
      tenantId,
      workbookId,
      headerRowId,
      'order_id',
    );

    if (!headerOrderId) {
      throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
    }

    const currentStatus =
      (await readCell(context.tx, tenantId, workbookId, headerRowId, 'status')) ||
      'DRAFT';
    if (!['DRAFT', 'CONFIRMED'].includes(currentStatus)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: ${currentStatus} cannot move to CONFIRMED`,
      );
    }

    const targetLineRowIds =
      lineIds && lineIds.length > 0
        ? lineIds.map((lineId) => `${orderId}-L${lineId}`)
        : await listLineRowIds(
            context.tx,
            tenantId,
            workbookId,
            `${orderId}-L%`,
          );

    if (targetLineRowIds.length === 0) {
      throw new Error(`ORDER_LINES_NOT_FOUND: ${orderId}`);
    }

    const confirmedAt = new Date().toISOString();
    for (const rowId of targetLineRowIds) {
      const existingOrderId = await readCell(
        context.tx,
        tenantId,
        workbookId,
        rowId,
        'order_id',
      );
      if (!existingOrderId) {
        throw new Error(`ORDER_LINE_NOT_FOUND: ${rowId}`);
      }

      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        rowId,
        'status',
        'CONFIRMED',
      );
      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        rowId,
        'confirmed_at',
        confirmedAt,
      );
    }

    await upsertCell(
      context.tx,
      tenantId,
      workbookId,
      headerRowId,
      'status',
      'CONFIRMED',
    );
    await upsertCell(
      context.tx,
      tenantId,
      workbookId,
      headerRowId,
      'confirmed_at',
      confirmedAt,
    );

    return {
      orderId,
      linesConfirmed: targetLineRowIds.length,
      status: 'CONFIRMED',
    };
  }
}
