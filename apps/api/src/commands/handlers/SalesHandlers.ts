import type { CommandEnvelope } from '@erp/domain/commands/types';
import { withAffectsWorkbooks } from '@erp/contracts/outbox-refresh';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

// Stub for sales domain commands (flattened lines per spec recommendation)
// Basic create writes cells; full allocate/fulfill would also touch inventory + ledger.

const SALES_ORDERS_WORKBOOK_ID = '00000000-0000-0000-0000-000000000015';
const INVENTORY_BALANCES_WORKBOOK_ID =
  '00000000-0000-0000-0000-000000000014';
const PRODUCTS_WORKBOOK_ID = '00000000-0000-0000-0000-000000000010';
const FULFILLMENTS_WORKBOOK_ID =
  '00000000-0000-0000-0000-000000000017';
const STOCK_AVAILABLE_ACCOUNT_ID =
  '100000000000000000000000000000000001';
const STOCK_RESERVED_ACCOUNT_ID =
  '300000000000000000000000000000000001';
const STOCK_SHIPPED_ACCOUNT_ID =
  '400000000000000000000000000000000001';
const INVENTORY_VALUATION_ACCOUNT_ID =
  '500000000000000000000000000000000001';
const COGS_ACCOUNT_ID = '600000000000000000000000000000000001';

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
  { orderId: string; linesAllocated: number; status: string; affects_workbooks?: string[] }
> {
  readonly commandType = 'fulfillment.allocate';

  async executeBusinessLogic(
    envelope: CommandEnvelope<FulfillmentAllocatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ orderId: string; linesAllocated: number; status: string; affects_workbooks?: string[] }> {
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

    return withAffectsWorkbooks(
      {
        orderId,
        linesAllocated: lines.length,
        status: nextHeaderStatus,
      },
      [workbookId, INVENTORY_BALANCES_WORKBOOK_ID],
      workbookId,
    );
  }
}

export type OrderFulfillShipPayload = {
  orderId: string;
  fulfillmentId?: string;
  lines: Array<{
    lineId: string;
    productId: string;
    warehouseId?: string;
    qty: number;
  }>;
};

export class OrderFulfillShipHandler extends CommandHandlerBase<
  OrderFulfillShipPayload,
  { orderId: string; linesShipped: number; status: string; fulfillmentId?: string; affects_workbooks?: string[] }
> {
  readonly commandType = 'order.fulfillShip';

  async executeBusinessLogic(
    envelope: CommandEnvelope<OrderFulfillShipPayload>,
    context: CommandExecutionContext,
  ): Promise<{ orderId: string; linesShipped: number; status: string; fulfillmentId?: string; affects_workbooks?: string[] }> {
    const { orderId, fulfillmentId, lines } = envelope.payload;
    const tenantId = envelope.tenantId;
    const workbookId = envelope.workbookId || SALES_ORDERS_WORKBOOK_ID;

    if (!orderId || !Array.isArray(lines) || lines.length === 0) {
      throw new Error('ASSERT_FAILED: orderId and at least one fulfill line required');
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
    if (!['ALLOCATED', 'SHIPPED'].includes(currentStatus)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: ${currentStatus} cannot move to SHIPPED`,
      );
    }

    const shippedAt = new Date().toISOString();
    const resolvedFulfillmentId = fulfillmentId || `FUL-${envelope.commandId.slice(0, 8)}`;

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line) continue;

      const { lineId, productId, warehouseId: lineWh, qty } = line;
      if (!lineId || !productId || !Number.isFinite(qty) || qty <= 0) {
        throw new Error(
          'ASSERT_FAILED: lineId, productId, and positive qty required',
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
      if (currentLineStatus !== 'ALLOCATED') {
        throw new Error(
          `INVALID_LINE_STATUS_TRANSITION: ${currentLineStatus} cannot move to SHIPPED`,
        );
      }

      // Determine warehouse (prefer payload, fallback to prior allocation on line)
      const warehouseId =
        lineWh ||
        (await readCell(context.tx, tenantId, workbookId, salesRowId, 'warehouse_id')) ||
        'w1';

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
      if (currentReserved < qty) {
        throw new Error(
          `INSUFFICIENT_RESERVED_STOCK: ${productId}:${warehouseId} has reserved ${currentReserved}, needs ${qty}`,
        );
      }

      const nextOnHand = currentOnHand - qty;
      const nextReserved = currentReserved - qty;
      if (nextOnHand < 0 || nextReserved < 0) {
        throw new Error('INVENTORY_NEGATIVE: ship would result in negative stock');
      }

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
        'quantity_on_hand',
        String(nextOnHand),
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
        String(nextOnHand - nextReserved),
      );
      await upsertCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'last_shipped_order_id',
        orderId,
      );

      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'status',
        'SHIPPED',
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
        'shipped_qty',
        String(qty),
      );
      await upsertCell(
        context.tx,
        tenantId,
        workbookId,
        salesRowId,
        'shipped_at',
        shippedAt,
      );

      // qty movement: reserved -> shipped
      try {
        const transferIdDec = `ship_${envelope.commandId}_${orderId}_${lineId}`.slice(0, 64);
        await context.ledger.createTransfer({
          transferIdDec,
          debitAccountIdDec: STOCK_RESERVED_ACCOUNT_ID,
          creditAccountIdDec: STOCK_SHIPPED_ACCOUNT_ID,
          amountDec: String(qty),
          ledgerCode: '1',
          movementKind: 'stock_ship',
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
        // Early Phase 0: tolerate ledger while workbook state advances.
      }

      // COGS transition using standard_cost (or cost) from Products at ship time
      const costText =
        (await readCell(context.tx, tenantId, PRODUCTS_WORKBOOK_ID, productId, 'standard_cost')) ||
        (await readCell(context.tx, tenantId, PRODUCTS_WORKBOOK_ID, productId, 'cost')) ||
        '0';
      const unitCost = parseNumber(costText, 0);
      const cogsAmount = (qty * unitCost).toFixed(2);
      try {
        const cogsTid = `cogs_${envelope.commandId}_${orderId}_${lineId}`.slice(0, 64);
        await context.ledger.createTransfer({
          transferIdDec: cogsTid,
          debitAccountIdDec: COGS_ACCOUNT_ID,
          creditAccountIdDec: INVENTORY_VALUATION_ACCOUNT_ID,
          amountDec: cogsAmount,
          ledgerCode: '1',
          movementKind: 'cogs_fulfill',
          payloadHash: envelope.requestHash || cogsTid,
          commandId: envelope.commandId,
          commandLineIndex: index,
          domainObjectRef: {
            orderId,
            lineId,
            productId,
            qty,
            unitCost,
            inventoryRowId,
          },
        });
      } catch {
        // tolerate for demo
      }
    }

    const allLineRowIds = await listLineRowIds(
      context.tx,
      tenantId,
      workbookId,
      `${orderId}-L%`,
    );
    const allShippedStatuses = await Promise.all(
      allLineRowIds.map((rowId) =>
        readCell(context.tx, tenantId, workbookId, rowId, 'status'),
      ),
    );
    const nextHeaderStatus = allShippedStatuses.every((status) => status === 'SHIPPED')
      ? 'SHIPPED'
      : 'ALLOCATED';

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
      'shipped_at',
      shippedAt,
    );

    return withAffectsWorkbooks(
      {
        orderId,
        linesShipped: lines.length,
        status: nextHeaderStatus,
        fulfillmentId: resolvedFulfillmentId,
      },
      [workbookId, INVENTORY_BALANCES_WORKBOOK_ID],
      workbookId,
    );
  }
}

export type PaymentRecordPayload = {
  orderId: string;
  customerId: string;
  amount: string;
  paymentMethod: string;
};

export class PaymentRecordHandler extends CommandHandlerBase<
  PaymentRecordPayload,
  { orderId: string; paymentId: string; status: string }
> {
  readonly commandType = 'payment.record';

  async executeBusinessLogic(
    envelope: CommandEnvelope<PaymentRecordPayload>,
    context: CommandExecutionContext,
  ): Promise<{ orderId: string; paymentId: string; status: string }> {
    const { orderId, customerId, amount, paymentMethod } = envelope.payload;
    const tenantId = envelope.tenantId;
    const financialWorkbookId = '00000000-0000-0000-0000-000000000004'; // Purchase Ledger / Financials
    const salesWorkbookId = envelope.workbookId || SALES_ORDERS_WORKBOOK_ID;

    if (!orderId || !customerId || !amount) {
      throw new Error('ASSERT_FAILED: orderId, customerId, and amount required');
    }

    const headerRowId = `${orderId}-HDR`;
    const existingOrderId = await readCell(
      context.tx,
      tenantId,
      salesWorkbookId,
      headerRowId,
      'order_id'
    );
    if (!existingOrderId) {
      throw new Error(`ORDER_NOT_FOUND: ${orderId}`);
    }

    const paymentId = `PAY-${envelope.commandId.slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    // Write financial ledger entry in workbook 004
    const cells: Array<[string, string]> = [
      ['vendor_name', customerId],
      ['invoice_no', orderId],
      ['amount_due', '0.00'],
      ['payment_status', 'Paid'],
      ['payment_id', paymentId],
      ['payment_method', paymentMethod || 'Cash'],
      ['amount_paid', amount],
      ['paid_at', nowIso],
    ];

    for (const [col, val] of cells) {
      await upsertCell(context.tx, tenantId, financialWorkbookId, paymentId, col, val);
    }

    // Update sales order status to INVOICED
    await upsertCell(context.tx, tenantId, salesWorkbookId, headerRowId, 'status', 'INVOICED');
    await upsertCell(context.tx, tenantId, salesWorkbookId, headerRowId, 'payment_status', 'Paid');
    await upsertCell(context.tx, tenantId, salesWorkbookId, headerRowId, 'payment_id', paymentId);

    // Update lines status to INVOICED
    const targetLineRowIds = await listLineRowIds(
      context.tx,
      tenantId,
      salesWorkbookId,
      `${orderId}-L%`
    );
    for (const rowId of targetLineRowIds) {
      await upsertCell(context.tx, tenantId, salesWorkbookId, rowId, 'status', 'INVOICED');
    }

    // Ledger posting for cash received (debit Cash, credit AR)
    try {
      await context.ledger.createTransfer({
        transferIdDec: `pay_${envelope.commandId}_${orderId}`.slice(0, 64),
        debitAccountIdDec: '800000000000000000000000000000000001', // CASH
        creditAccountIdDec: '700000000000000000000000000000000001', // AR
        amountDec: amount,
        ledgerCode: '1',
        movementKind: 'cash_received',
        payloadHash: envelope.requestHash || paymentId,
        commandId: envelope.commandId,
        commandLineIndex: 0,
        domainObjectRef: { orderId, customerId, paymentId, paymentMethod },
      });
    } catch (e) {
      // ignore
    }

    return { orderId, paymentId, status: 'INVOICED' };
  }
}

