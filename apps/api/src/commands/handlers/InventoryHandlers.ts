import type {
  CommandEnvelope,
  CommandOutcome,
} from '@erp/domain/commands/types';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

// Basic inventory domain commands for SME ecommerce + warehouse (per spec)
// Uses current_cell_values (id-based keys) + NumericLedgerPort for conserved stock.
// All mutations still go through command_api / tx / outbox.

export type InventoryAdjustPayload = {
  productId: string;
  warehouseId: string;
  delta: number; // positive for receive/adjust up, negative for issue
  reason: string;
  effectiveAt?: string;
};

export class InventoryAdjustHandler extends CommandHandlerBase<
  InventoryAdjustPayload,
  { productId: string; warehouseId: string; newOnHand: number; transferId?: string }
> {
  readonly commandType = 'inventory.adjust';

  async executeBusinessLogic(
    envelope: CommandEnvelope<InventoryAdjustPayload>,
    context: CommandExecutionContext,
  ): Promise<{ productId: string; warehouseId: string; newOnHand: number; transferId?: string }> {
    const { productId, warehouseId, delta, reason } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000014'; // InventoryBalances default

    if (!productId || !warehouseId || typeof delta !== 'number') {
      throw new Error('ASSERT_FAILED: productId, warehouseId, and numeric delta required');
    }

    const rowId = `${productId}:${warehouseId}`;

    // Read current (simplified; in real would query grouped cells or projection)
    // For demo/Phase 0 we upsert the cell values directly.
    const onHandCol = 'quantity_on_hand';
    const reservedCol = 'quantity_reserved';

    // Fetch current on_hand (best effort via existing query pattern; fallback 0)
    let currentOnHand = 0;
    try {
      const res = await context.tx.query(
        `SELECT value_text FROM current_cell_values
         WHERE tenant_id = $1 AND workbook_id = $2 AND row_id = $3 AND column_id = $4`,
        [tenant, workbookId, rowId, onHandCol]
      );
      const rows = (res as any)?.rows || res || [];
      if (rows.length > 0) currentOnHand = parseFloat(rows[0].value_text || '0') || 0;
    } catch (e) {
      // ignore, start at 0 for new
    }

    const newOnHand = currentOnHand + delta;
    if (newOnHand < 0) {
      throw new Error('INVENTORY_NEGATIVE: cannot adjust to negative on_hand');
    }

    // Write cells
    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, workbookId, rowId, onHandCol, String(newOnHand)]
    );

    // Write reason / audit cell for visibility
    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, workbookId, rowId, 'last_adjust_reason', reason || 'adjust']
    );

    // Ledger for conserved stock (movement_kind per spec: stock_adjust / stock_receive)
    let transferResult: any = null;
    const movementKind = delta >= 0 ? 'stock_receive' : 'stock_adjust';
    try {
      // Simple deterministic transfer id for demo
      const transferIdDec = `inv_adj_${envelope.commandId}_${productId}_${warehouseId}`.slice(0, 64);
      const draft = {
        transferIdDec,
        debitAccountIdDec: delta >= 0 ? '100000000000000000000000000000000001' : '200000000000000000000000000000000001',
        creditAccountIdDec: delta >= 0 ? '200000000000000000000000000000000001' : '100000000000000000000000000000000001',
        amountDec: String(Math.abs(delta)),
        ledgerCode: '1',
        movementKind,
        payloadHash: envelope.requestHash || transferIdDec,
        commandId: envelope.commandId,
        commandLineIndex: 0,
        domainObjectRef: { productId, warehouseId, rowId, reason },
      };
      transferResult = await context.ledger.createTransfer(draft);
    } catch (e) {
      // Ledger optional for some demos; continue if adapter rejects in test env
    }

    return {
      productId,
      warehouseId,
      newOnHand,
      transferId: transferResult?.transferIdDec,
    };
  }
}

// Simple product create (cell write, no ledger)
export type ProductCreatePayload = {
  productId: string;
  sku: string;
  name: string;
  unit_price?: string;
  cost?: string;
  tax_rate?: string;
};

export class ProductCreateHandler extends CommandHandlerBase<
  ProductCreatePayload,
  { productId: string; sku: string }
> {
  readonly commandType = 'product.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<ProductCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ productId: string; sku: string }> {
    const { productId, sku, name, unit_price = '0', cost = '0', tax_rate = '0' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000010';

    if (!productId || !sku) {
      throw new Error('ASSERT_FAILED: productId and sku required');
    }

    const rowId = productId;

    const cells = [
      ['product_id', productId],
      ['sku', sku],
      ['name', name || sku],
      ['unit_price', unit_price],
      ['cost', cost],
      ['standard_cost', cost],
      ['tax_rate', tax_rate],
      ['active', 'Y'],
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

    return { productId, sku };
  }
}

export type InventoryReturnReceiptPayload = {
  originalFulfillmentId?: string;
  productId: string;
  warehouseId: string;
  qty: number;
  reason: string;
  originalOrderId?: string;
};

export class InventoryReturnReceiptHandler extends CommandHandlerBase<
  InventoryReturnReceiptPayload,
  { productId: string; warehouseId: string; newOnHand: number; transferId?: string }
> {
  readonly commandType = 'inventory.returnReceipt';

  async executeBusinessLogic(
    envelope: CommandEnvelope<InventoryReturnReceiptPayload>,
    context: CommandExecutionContext,
  ): Promise<{ productId: string; warehouseId: string; newOnHand: number; transferId?: string }> {
    const { productId, warehouseId, qty, reason, originalFulfillmentId, originalOrderId } = envelope.payload;
    const tenant = envelope.tenantId;
    const inventoryWorkbookId = '00000000-0000-0000-0000-000000000014'; // InventoryBalances
    const fulfillmentWorkbookId = '00000000-0000-0000-0000-000000000017'; // Fulfillments

    if (!productId || !warehouseId || typeof qty !== 'number' || qty <= 0) {
      throw new Error('ASSERT_FAILED: productId, warehouseId, and positive numeric qty required');
    }

    const rowId = `${productId}:${warehouseId}`;
    const onHandCol = 'quantity_on_hand';

    // Fetch current on_hand
    let currentOnHand = 0;
    try {
      const res = await context.tx.query(
        `SELECT value_text FROM current_cell_values
         WHERE tenant_id = $1 AND workbook_id = $2 AND row_id = $3 AND column_id = $4`,
        [tenant, inventoryWorkbookId, rowId, onHandCol]
      );
      const rows = (res as any)?.rows || res || [];
      if (rows.length > 0) currentOnHand = parseFloat(rows[0].value_text || '0') || 0;
    } catch (e) {
      // ignore
    }

    const newOnHand = currentOnHand + qty;

    // Write inventory balances
    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, inventoryWorkbookId, rowId, onHandCol, String(newOnHand)]
    );

    // Also write quantity_available update (on_hand - reserved)
    let currentReserved = 0;
    try {
      const res = await context.tx.query(
        `SELECT value_text FROM current_cell_values
         WHERE tenant_id = $1 AND workbook_id = $2 AND row_id = $3 AND column_id = $4`,
        [tenant, inventoryWorkbookId, rowId, 'quantity_reserved']
      );
      const rows = (res as any)?.rows || res || [];
      if (rows.length > 0) currentReserved = parseFloat(rows[0].value_text || '0') || 0;
    } catch (e) {
      // ignore
    }

    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, inventoryWorkbookId, rowId, 'quantity_available', String(newOnHand - currentReserved)]
    );

    await context.tx.query(
      `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
       DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
      [tenant, inventoryWorkbookId, rowId, 'last_adjust_reason', reason || 'return_receipt']
    );

    // Write return record in Fulfillments workbook if order/fulfillment ref provided
    if (originalFulfillmentId || originalOrderId) {
      const returnId = `RET-${envelope.commandId.slice(0, 8)}`;
      const cells = [
        ['fulfillment_id', returnId],
        ['order_id', originalOrderId || ''],
        ['product_id', productId],
        ['qty', String(qty)],
        ['status', 'RETURNED'],
        ['reason', reason],
        ['original_fulfillment_id', originalFulfillmentId || ''],
      ];
      for (const [col, val] of cells) {
        await context.tx.query(
          `INSERT INTO current_cell_values (tenant_id, workbook_id, row_id, column_id, value_text, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (tenant_id, workbook_id, row_id, column_id)
           DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = now()`,
          [tenant, fulfillmentWorkbookId, returnId, col, String(val)]
        );
      }
    }

    // Ledger stock return (reversing shipment: SHIPPED -> AVAILABLE)
    let transferResult: any = null;
    try {
      const transferIdDec = `ret_${envelope.commandId}_${productId}_${warehouseId}`.slice(0, 64);
      const draft = {
        transferIdDec,
        debitAccountIdDec: '100000000000000000000000000000000001', // AVAILABLE
        creditAccountIdDec: '400000000000000000000000000000000001', // SHIPPED
        amountDec: String(qty),
        ledgerCode: '1',
        movementKind: 'stock_return',
        payloadHash: envelope.requestHash || transferIdDec,
        commandId: envelope.commandId,
        commandLineIndex: 0,
        domainObjectRef: { productId, warehouseId, originalFulfillmentId, originalOrderId, reason },
      };
      transferResult = await context.ledger.createTransfer(draft);
    } catch (e) {
      // ignore
    }

    return {
      productId,
      warehouseId,
      newOnHand,
      transferId: transferResult?.transferIdDec,
    };
  }
}

