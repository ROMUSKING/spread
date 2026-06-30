import type { CommandEnvelope } from '@erp/domain/commands/types';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

// Stub for sales domain commands (flattened lines per spec recommendation)
// Basic create writes cells; full allocate/fulfill would also touch inventory + ledger.

const SALES_ORDERS_WORKBOOK_ID = '00000000-0000-0000-0000-000000000015';
const INVENTORY_BALANCES_WORKBOOK_ID =
  '00000000-0000-0000-0000-000000000014';
const STOCK_AVAILABLE_ACCOUNT_ID =
  '100000000000000000000000000000000001';
const STOCK_RESERVED_ACCOUNT_ID =
  '300000000000000000000000000000000001';

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

function parseNumber(value: string | null, fallback: number = 0): number {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
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

export type FulfillmentAllocatePayload = {
  orderId: string;
  lines: Array<{
    lineId: string;
    productId: string;
    warehouseId: string;
    qty: number;
  }>;
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

export class FulfillmentAllocateHandler extends CommandHandlerBase<
  FulfillmentAllocatePayload,
  { orderId: string; linesAllocated: number; status: string }
> {
  readonly commandType = 'fulfillment.allocate';

  async executeBusinessLogic(
    envelope: CommandEnvelope<FulfillmentAllocatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ orderId: string; linesAllocated: number; status: string }> {
    const { orderId, lines } = envelope.payload;
    const tenantId = envelope.tenantId;
    const workbookId = envelope.workbookId || SALES_ORDERS_WORKBOOK_ID;

    if (!orderId || !Array.isArray(lines) || lines.length === 0) {
      throw new Error('ASSERT_FAILED: orderId and at least one allocation line required');
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
    if (!['CONFIRMED', 'ALLOCATED'].includes(currentStatus)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: ${currentStatus} cannot move to ALLOCATED`,
      );
    }

    const allocatedAt = new Date().toISOString();

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line) continue;

      const { lineId, productId, warehouseId, qty } = line;
      if (!lineId || !productId || !warehouseId || !Number.isFinite(qty) || qty <= 0) {
        throw new Error(
          'ASSERT_FAILED: lineId, productId, warehouseId, and positive qty required',
        );
      }

      const salesRowId = `${orderId}-L${lineId}`;
      const existingOrderId = await readCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'order_id',
      );
      if (!existingOrderId) {
        throw new Error(`ORDER_LINE_NOT_FOUND: ${salesRowId}`);
      }

      const existingProductId = await readCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'product_id',
      );
      if (existingProductId !== productId) {
        throw new Error(
          `PRODUCT_MISMATCH: expected ${existingProductId}, received ${productId}`,
        );
      }

      const currentLineStatus =
        (await readCell(context.tx, tenantId, workbookId, salesRowId, 'status')) ||
        currentStatus;
      if (currentLineStatus !== 'CONFIRMED') {
        throw new Error(
          `INVALID_LINE_STATUS_TRANSITION: ${currentLineStatus} cannot move to ALLOCATED`,
        );
      }

      const inventoryRowId = `${productId}:${warehouseId}`;
      const currentOnHand = parseNumber(
        await readCell(
          context.tx,
          tenantId,
          INVENTORY_BALANCES_WORKBOOK_ID,
          inventoryRowId,
          'quantity_on_hand',
        ),
        0,
      );
      const currentReserved = parseNumber(
        await readCell(
          context.tx,
          tenantId,
          INVENTORY_BALANCES_WORKBOOK_ID,
          inventoryRowId,
          'quantity_reserved',
        ),
        0,
      );
      const available = currentOnHand - currentReserved;
      if (available < qty) {
        throw new Error(
          `INSUFFICIENT_AVAILABLE_STOCK: ${productId}:${warehouseId} has ${available}, needs ${qty}`,
        );
      }

      const nextReserved = currentReserved + qty;
      await upsertCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'product_id',
        productId,
      );
      await upsertCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'warehouse_id',
        warehouseId,
      );
      await upsertCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'quantity_reserved',
        String(nextReserved),
      );
      await upsertCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'quantity_available',
        String(currentOnHand - nextReserved),
      );
      await upsertCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'last_allocated_order_id',
        orderId,
      );

      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'status',
        'ALLOCATED',
      );
      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'warehouse_id',
        warehouseId,
      );
      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'allocated_qty',
        String(qty),
      );
      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'allocated_at',
        allocatedAt,
      );

      try {
        const transferIdDec = `alloc_${envelope.commandId}_${orderId}_${lineId}`.slice(
          0,
          64,
        );
        await context.ledger.createTransfer({
          transferIdDec,
          debitAccountIdDec: STOCK_AVAILABLE_ACCOUNT_ID,
          creditAccountIdDec: STOCK_RESERVED_ACCOUNT_ID,
          amountDec: String(qty),
          ledgerCode: '1',
          movementKind: 'stock_reserve',
          payloadHash: envelope.requestHash || transferIdDec,
          commandId: envelope.commandId,
          commandLineIndex: index,
          domainObjectRef: {
            orderId,
            lineId,
            productId,
            warehouseId,
            inventoryRowId,
          },
        });
      } catch {
        // Early Phase 0 handlers keep reservation flow tolerant in environments
        // where the demo ledger adapter may reject while workbook state is valid.
      }
    }

    const allLineRowIds = await listLineRowIds(
      context.tx,
      tenantId,
      workbookId,
      `${orderId}-L%`,
    );
    const allAllocated = await Promise.all(
      allLineRowIds.map((rowId) =>
        readCell(context.tx, tenantId, workbookId, rowId, 'status'),
      ),
    );
    const nextHeaderStatus = allAllocated.every((status) => status === 'ALLOCATED')
      ? 'ALLOCATED'
      : 'CONFIRMED';

    await upsertCell(
      context.tx,
      tenantId,
      workbookId,
      headerRowId,
      'status',
      nextHeaderStatus,
    );
    await upsertCell(
      context.tx,
      tenantId,
      workbookId,
      headerRowId,
      'allocated_at',
      allocatedAt,
    );

    return {
      orderId,
      linesAllocated: lines.length,
      status: nextHeaderStatus,
    };
  }
}
