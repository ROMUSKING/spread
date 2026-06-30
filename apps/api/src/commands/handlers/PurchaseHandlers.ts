import type { CommandEnvelope } from '@erp/domain/commands/types';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

const PURCHASE_ORDERS_WORKBOOK_ID =
  '00000000-0000-0000-0000-000000000016';
const INVENTORY_BALANCES_WORKBOOK_ID =
  '00000000-0000-0000-0000-000000000014';
const STOCK_AVAILABLE_ACCOUNT_ID =
  '100000000000000000000000000000000001';
const STOCK_OFFSET_ACCOUNT_ID =
  '200000000000000000000000000000000001';

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

function parseNumber(value: string | null, fallback: number = 0): number {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type PurchaseOrderCreatePayload = {
  poId: string;
  supplierId: string;
  lines: Array<{
    lineId?: string;
    productId: string;
    qtyOrdered: number;
    unit_price: string;
  }>;
  status?: string;
};

export class PurchaseOrderCreateHandler extends CommandHandlerBase<
  PurchaseOrderCreatePayload,
  { poId: string; linesWritten: number }
> {
  readonly commandType = 'purchaseOrder.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<PurchaseOrderCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ poId: string; linesWritten: number }> {
    const { poId, supplierId, lines, status = 'DRAFT' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || PURCHASE_ORDERS_WORKBOOK_ID;

    if (!poId || !supplierId || !lines || lines.length === 0) {
      throw new Error(
        'ASSERT_FAILED: poId, supplierId, and at least one line required',
      );
    }

    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const lineId = line.lineId || `${i + 1}`;
      const rowId = `${poId}-L${lineId}`;
      const lineTotal =
        (parseFloat(line.unit_price) || 0) * (line.qtyOrdered || 0);

      const cells: Array<[string, string]> = [
        ['po_id', poId],
        ['line_id', lineId],
        ['supplier_id', supplierId],
        ['product_id', line.productId],
        ['qty_ordered', String(line.qtyOrdered)],
        ['unit_price', line.unit_price],
        ['status', status],
        ['line_total', String(lineTotal)],
      ];

      for (const [col, val] of cells) {
        await upsertCell(context.tx, tenant, workbookId, rowId, col, String(val));
      }

      count++;
    }

    const hdrRow = `${poId}-HDR`;
    const headerCells: Array<[string, string]> = [
      ['po_id', poId],
      ['supplier_id', supplierId],
      ['status', status],
    ];

    for (const [col, val] of headerCells) {
      await upsertCell(context.tx, tenant, workbookId, hdrRow, col, String(val));
    }

    return { poId, linesWritten: count };
  }
}

export type PurchaseOrderReceivePayload = {
  poId: string;
  receiptId?: string;
  lines: Array<{
    poLineId: string;
    productId: string;
    warehouseId: string;
    qtyReceived: number;
    unitCost: string;
  }>;
};

export class PurchaseOrderReceiveHandler extends CommandHandlerBase<
  PurchaseOrderReceivePayload,
  {
    poId: string;
    receiptId: string;
    linesReceived: number;
    headerStatus: string;
  }
> {
  readonly commandType = 'purchaseOrder.receive';

  async executeBusinessLogic(
    envelope: CommandEnvelope<PurchaseOrderReceivePayload>,
    context: CommandExecutionContext,
  ): Promise<{
    poId: string;
    receiptId: string;
    linesReceived: number;
    headerStatus: string;
  }> {
    const { poId, receiptId, lines } = envelope.payload;
    const tenantId = envelope.tenantId;
    const purchaseWorkbookId = envelope.workbookId || PURCHASE_ORDERS_WORKBOOK_ID;
    const resolvedReceiptId =
      receiptId || `RCV-${envelope.commandId.slice(0, 8)}`;

    if (!poId || !lines || lines.length === 0) {
      throw new Error('ASSERT_FAILED: poId and at least one receipt line required');
    }

    const lineStatuses: string[] = [];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line) continue;

      const { poLineId, productId, warehouseId, qtyReceived, unitCost } = line;
      if (!poLineId || !productId || !warehouseId) {
        throw new Error('ASSERT_FAILED: poLineId, productId, and warehouseId required');
      }
      if (typeof qtyReceived !== 'number' || !Number.isFinite(qtyReceived) || qtyReceived <= 0) {
        throw new Error('ASSERT_FAILED: qtyReceived must be a positive number');
      }

      const poLineRowId = `${poId}-L${poLineId}`;
      const existingProductId = await readCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'product_id',
      );
      if (!existingProductId) {
        throw new Error(`PO_LINE_NOT_FOUND: ${poLineRowId}`);
      }
      if (existingProductId !== productId) {
        throw new Error(
          `PRODUCT_MISMATCH: expected ${existingProductId}, received ${productId}`,
        );
      }

      const qtyOrderedText = await readCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'qty_ordered',
      );
      const qtyReceivedText = await readCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'qty_received',
      );
      const unitPriceText = await readCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'unit_price',
      );

      const orderedQty = parseNumber(qtyOrderedText, NaN);
      if (!Number.isFinite(orderedQty) || orderedQty <= 0) {
        throw new Error(`INVALID_PO_LINE_QTY: ${poLineRowId}`);
      }

      const previousReceivedQty = parseNumber(qtyReceivedText, 0);
      const cumulativeReceivedQty = previousReceivedQty + qtyReceived;
      const orderedUnitPrice = parseNumber(unitPriceText, 0);
      const receivedUnitCost = parseNumber(unitCost, NaN);
      if (!Number.isFinite(receivedUnitCost)) {
        throw new Error('ASSERT_FAILED: unitCost must be numeric');
      }

      const quantityTolerance = Math.abs(orderedQty) * 0.05;
      const quantityVariance = Math.abs(cumulativeReceivedQty - orderedQty);
      const unitVariance = Math.abs(receivedUnitCost - orderedUnitPrice);
      const hasVariance =
        quantityVariance > quantityTolerance || unitVariance > 0.000001;
      const varianceAmount =
        quantityVariance > quantityTolerance ? quantityVariance : unitVariance;
      const lineStatus =
        cumulativeReceivedQty >= orderedQty ? 'RECEIVED' : 'PARTIAL';
      lineStatuses.push(lineStatus);

      await upsertCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'qty_received',
        String(cumulativeReceivedQty),
      );
      await upsertCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'status',
        lineStatus,
      );
      await upsertCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'variance_flag',
        hasVariance ? 'true' : 'false',
      );
      await upsertCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'variance_amount',
        String(varianceAmount),
      );
      await upsertCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'unit_cost_received',
        unitCost,
      );
      await upsertCell(
        context.tx,
        tenantId,
        purchaseWorkbookId,
        poLineRowId,
        'last_receipt_id',
        resolvedReceiptId,
      );

      const inventoryRowId = `${productId}:${warehouseId}`;
      const onHandText = await readCell(
        context.tx,
        tenantId,
        INVENTORY_BALANCES_WORKBOOK_ID,
        inventoryRowId,
        'quantity_on_hand',
      );
      const nextOnHand = parseNumber(onHandText, 0) + qtyReceived;

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
        'last_receipt_id',
        resolvedReceiptId,
      );

      try {
        const transferIdDec = `po_recv_${envelope.commandId}_${poId}_${poLineId}`.slice(
          0,
          64,
        );
        await context.ledger.createTransfer({
          transferIdDec,
          debitAccountIdDec: STOCK_AVAILABLE_ACCOUNT_ID,
          creditAccountIdDec: STOCK_OFFSET_ACCOUNT_ID,
          amountDec: String(qtyReceived),
          ledgerCode: '1',
          movementKind: 'stock_receive',
          payloadHash: envelope.requestHash || transferIdDec,
          commandId: envelope.commandId,
          commandLineIndex: index,
          domainObjectRef: {
            poId,
            poLineId,
            receiptId: resolvedReceiptId,
            productId,
            warehouseId,
            inventoryRowId,
          },
        });
      } catch {
        // Keep the receipt flow tolerant in early environments where the
        // demo ledger adapter may reject while the workbook update is valid.
      }
    }

    const headerStatus = lineStatuses.every((status) => status === 'RECEIVED')
      ? 'RECEIVED'
      : 'PARTIAL';
    const headerRowId = `${poId}-HDR`;
    await upsertCell(
      context.tx,
      tenantId,
      purchaseWorkbookId,
      headerRowId,
      'status',
      headerStatus,
    );
    await upsertCell(
      context.tx,
      tenantId,
      purchaseWorkbookId,
      headerRowId,
      'last_receipt_id',
      resolvedReceiptId,
    );

    return {
      poId,
      receiptId: resolvedReceiptId,
      linesReceived: lines.length,
      headerStatus,
    };
  }
}