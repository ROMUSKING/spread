"use client";

import { useCallback } from "react";
import type {
  BusinessActionStatusMap,
  FulfillmentAllocateInput,
  InventoryAdjustInput,
  InventoryReturnReceiptInput,
  PartyCreateInput,
  PaymentRecordInput,
  ProductCreateInput,
  PurchaseOrderCreateInput,
  PurchaseOrderReceiveInput,
  SalesOrderConfirmInput,
  SalesOrderCreateInput,
} from "../components/BusinessCommandCenter";
import type { WorkspaceEdge } from "../components/ExplorerPanel";
import { getCommandStatus } from "../lib/commandClient";
import { useCommand, type CommandSubmitResult } from "../lib/useCommand";
import { ALLOWED_WORKBOOKS } from "../lib/workbookConstants";
import { resolveWorkbooksToRefresh } from "../lib/workbookUtils";

const BUSINESS_COMMAND_POLL_ATTEMPTS = 8;
const BUSINESS_COMMAND_POLL_INTERVAL_MS = 750;

type CommandController<TPayload> = {
  submit: (payload: TPayload, submitOptions?: { workbookId?: string }) => Promise<CommandSubmitResult>;
  refresh: () => void;
};

export type UseBusinessCommandsParams = {
  tenantId: string;
  apiBaseUrl: string;
  edges: WorkspaceEdge[];
  refreshWorkbookSet: (workbookIds: string[]) => Promise<void>;
  setCommandNotice: (message: string | null) => void;
};

export function useBusinessCommands({
  tenantId,
  apiBaseUrl,
  edges,
  refreshWorkbookSet,
  setCommandNotice,
}: UseBusinessCommandsParams) {
  const productCreateCmd = useCommand("product.create", { tenantId, baseUrl: apiBaseUrl });
  const inventoryAdjustCmd = useCommand("inventory.adjust", { tenantId, baseUrl: apiBaseUrl });
  const salesOrderCreateCmd = useCommand("salesOrder.create", { tenantId, baseUrl: apiBaseUrl });
  const salesOrderConfirmCmd = useCommand("salesOrder.confirm", { tenantId, baseUrl: apiBaseUrl });
  const fulfillmentAllocateCmd = useCommand("fulfillment.allocate", { tenantId, baseUrl: apiBaseUrl });
  const purchaseOrderCreateCmd = useCommand("purchaseOrder.create", { tenantId, baseUrl: apiBaseUrl });
  const purchaseOrderReceiveCmd = useCommand("purchaseOrder.receive", { tenantId, baseUrl: apiBaseUrl });
  const partyCreateCmd = useCommand("party.create", { tenantId, baseUrl: apiBaseUrl });
  const inventoryReturnReceiptCmd = useCommand("inventory.returnReceipt", { tenantId, baseUrl: apiBaseUrl });
  const paymentRecordCmd = useCommand("payment.record", { tenantId, baseUrl: apiBaseUrl });

  const settleBusinessCommand = useCallback(
    async (commandId: string, workbookId: string) => {
      for (let attempt = 0; attempt < BUSINESS_COMMAND_POLL_ATTEMPTS; attempt++) {
        const status = await getCommandStatus(commandId, {
          tenantId,
          baseUrl: apiBaseUrl,
          workbookId,
        }).catch(() => null);

        if (status && status.status !== "received" && status.status !== "pending") {
          return status;
        }

        await new Promise((resolve) => window.setTimeout(resolve, BUSINESS_COMMAND_POLL_INTERVAL_MS));
      }

      return null;
    },
    [apiBaseUrl, tenantId]
  );

  const runBusinessCommand = useCallback(
    async <TPayload,>({
      controller,
      payload,
      workbookId,
      refreshWorkbooks,
      successMessage,
      commandLabel,
    }: {
      controller: CommandController<TPayload>;
      payload: TPayload;
      workbookId: string;
      refreshWorkbooks: string[];
      successMessage: string;
      commandLabel: string;
    }): Promise<boolean> => {
      setCommandNotice(null);
      const result = await controller.submit(payload, { workbookId });

      if (!result.initiated) {
        setCommandNotice("Another command is still in progress. Wait for it to finish.");
        return false;
      }

      if (result.state === "ambiguous_requires_refresh") {
        await refreshWorkbookSet(refreshWorkbooks);
        controller.refresh();
        setCommandNotice(`${commandLabel} requires a refresh before retry.`);
        return false;
      }

      if (result.state === "command_pending" && result.commandId) {
        const settled = await settleBusinessCommand(result.commandId, workbookId);
        if (settled?.status === "committed") {
          const targets = resolveWorkbooksToRefresh(
            { workbookId, payload: settled.body },
            edges,
            ALLOWED_WORKBOOKS
          );
          await refreshWorkbookSet(targets.length > 0 ? targets : refreshWorkbooks);
          controller.refresh();
          setCommandNotice(successMessage);
          return true;
        }
        if (settled?.status === "ambiguous") {
          const targets = resolveWorkbooksToRefresh(
            { workbookId, payload: settled.body },
            edges,
            ALLOWED_WORKBOOKS
          );
          await refreshWorkbookSet(targets.length > 0 ? targets : refreshWorkbooks);
          controller.refresh();
          setCommandNotice(
            `${commandLabel} finished with an ambiguous outcome. The affected workbooks were refreshed.`
          );
          return false;
        }
        if (settled && (settled.status === "failed" || settled.status === "rejected")) {
          controller.refresh();
          setCommandNotice(settled.problem?.message || `${commandLabel} did not complete.`);
          return false;
        }

        setCommandNotice(
          `${commandLabel} is still pending. Watch the command status card before retrying.`
        );
        return false;
      }

      if (result.state === "committed") {
        await refreshWorkbookSet(refreshWorkbooks);
        setCommandNotice(successMessage);
        return true;
      }

      setCommandNotice(`${commandLabel} did not complete. Check the command status card for details.`);
      return false;
    },
    [edges, refreshWorkbookSet, settleBusinessCommand, setCommandNotice]
  );

  const handleCreateProduct = useCallback(
    async (input: ProductCreateInput) =>
      runBusinessCommand({
        controller: productCreateCmd,
        payload: {
          productId: input.productId,
          sku: input.sku,
          name: input.name,
          unit_price: input.unitPrice,
          cost: input.cost,
          tax_rate: input.taxRate,
        },
        workbookId: "00000000-0000-0000-0000-000000000010",
        refreshWorkbooks: ["00000000-0000-0000-0000-000000000010"],
        successMessage: `Product ${input.productId} created.`,
        commandLabel: "Product creation",
      }),
    [productCreateCmd, runBusinessCommand]
  );

  const handleAdjustInventory = useCallback(
    async (input: InventoryAdjustInput) =>
      runBusinessCommand({
        controller: inventoryAdjustCmd,
        payload: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          delta: Number(input.delta),
          reason: input.reason,
        },
        workbookId: "00000000-0000-0000-0000-000000000014",
        refreshWorkbooks: ["00000000-0000-0000-0000-000000000014"],
        successMessage: `Inventory adjusted for ${input.productId}:${input.warehouseId}.`,
        commandLabel: "Inventory adjustment",
      }),
    [inventoryAdjustCmd, runBusinessCommand]
  );

  const handleCreateSalesOrder = useCallback(
    async (input: SalesOrderCreateInput) =>
      runBusinessCommand({
        controller: salesOrderCreateCmd,
        payload: {
          orderId: input.orderId,
          customerId: input.customerId,
          lines: [
            {
              productId: input.productId,
              qty: Number(input.qty),
              unit_price: input.unitPrice,
            },
          ],
          status: input.status,
        },
        workbookId: "00000000-0000-0000-0000-000000000015",
        refreshWorkbooks: ["00000000-0000-0000-0000-000000000015"],
        successMessage: `Sales order ${input.orderId} created.`,
        commandLabel: "Sales order creation",
      }),
    [runBusinessCommand, salesOrderCreateCmd]
  );

  const handleConfirmSalesOrder = useCallback(
    async (input: SalesOrderConfirmInput) =>
      runBusinessCommand({
        controller: salesOrderConfirmCmd,
        payload: { orderId: input.orderId },
        workbookId: "00000000-0000-0000-0000-000000000015",
        refreshWorkbooks: ["00000000-0000-0000-0000-000000000015"],
        successMessage: `Sales order ${input.orderId} confirmed.`,
        commandLabel: "Sales order confirmation",
      }),
    [runBusinessCommand, salesOrderConfirmCmd]
  );

  const handleAllocateFulfillment = useCallback(
    async (input: FulfillmentAllocateInput) =>
      runBusinessCommand({
        controller: fulfillmentAllocateCmd,
        payload: {
          orderId: input.orderId,
          lines: [
            {
              lineId: input.lineId,
              productId: input.productId,
              warehouseId: input.warehouseId,
              qty: Number(input.qty),
            },
          ],
        },
        workbookId: "00000000-0000-0000-0000-000000000015",
        refreshWorkbooks: [
          "00000000-0000-0000-0000-000000000015",
          "00000000-0000-0000-0000-000000000014",
        ],
        successMessage: `Stock reserved for ${input.orderId}:${input.lineId}.`,
        commandLabel: "Stock reservation",
      }),
    [fulfillmentAllocateCmd, runBusinessCommand]
  );

  const handleCreatePurchaseOrder = useCallback(
    async (input: PurchaseOrderCreateInput) =>
      runBusinessCommand({
        controller: purchaseOrderCreateCmd,
        payload: {
          poId: input.poId,
          supplierId: input.supplierId,
          lines: [
            {
              productId: input.productId,
              qtyOrdered: Number(input.qtyOrdered),
              unit_price: input.unitPrice,
            },
          ],
          status: input.status,
        },
        workbookId: "00000000-0000-0000-0000-000000000016",
        refreshWorkbooks: ["00000000-0000-0000-0000-000000000016"],
        successMessage: `Purchase order ${input.poId} created.`,
        commandLabel: "Purchase order creation",
      }),
    [purchaseOrderCreateCmd, runBusinessCommand]
  );

  const handleReceivePurchaseOrder = useCallback(
    async (input: PurchaseOrderReceiveInput) =>
      runBusinessCommand({
        controller: purchaseOrderReceiveCmd,
        payload: {
          poId: input.poId,
          receiptId: input.receiptId || undefined,
          lines: [
            {
              poLineId: input.poLineId,
              productId: input.productId,
              warehouseId: input.warehouseId,
              qtyReceived: Number(input.qtyReceived),
              unitCost: input.unitCost,
            },
          ],
        },
        workbookId: "00000000-0000-0000-0000-000000000016",
        refreshWorkbooks: [
          "00000000-0000-0000-0000-000000000016",
          "00000000-0000-0000-0000-000000000014",
        ],
        successMessage: `Purchase order ${input.poId} received into ${input.warehouseId}.`,
        commandLabel: "Purchase order receipt",
      }),
    [purchaseOrderReceiveCmd, runBusinessCommand]
  );

  const handleCreateParty = useCallback(
    async (input: PartyCreateInput) =>
      runBusinessCommand({
        controller: partyCreateCmd,
        payload: {
          partyId: input.partyId,
          legalName: input.legalName,
          taxId: input.taxId,
          email: input.email,
          phone: input.phone,
          asCustomer: input.asCustomer
            ? { creditLimit: input.creditLimit, paymentTerms: input.paymentTerms }
            : undefined,
          asSupplier: input.asSupplier
            ? { leadTimeDays: input.leadTimeDays, paymentTerms: input.paymentTerms }
            : undefined,
        },
        workbookId: "00000000-0000-0000-0000-000000000023",
        refreshWorkbooks: [
          "00000000-0000-0000-0000-000000000023",
          "00000000-0000-0000-0000-000000000024",
          "00000000-0000-0000-0000-000000000025",
        ],
        successMessage: `Party ${input.partyId} created.`,
        commandLabel: "Party creation",
      }),
    [partyCreateCmd, runBusinessCommand]
  );

  const handleReceiveReturn = useCallback(
    async (input: InventoryReturnReceiptInput) =>
      runBusinessCommand({
        controller: inventoryReturnReceiptCmd,
        payload: {
          originalFulfillmentId: input.originalFulfillmentId || undefined,
          productId: input.productId,
          warehouseId: input.warehouseId,
          qty: Number(input.qty),
          reason: input.reason,
          originalOrderId: input.originalOrderId || undefined,
        },
        workbookId: "00000000-0000-0000-0000-000000000017",
        refreshWorkbooks: [
          "00000000-0000-0000-0000-000000000017",
          "00000000-0000-0000-0000-000000000014",
          "00000000-0000-0000-0000-000000000015",
        ],
        successMessage: `Returned stock received for product ${input.productId}.`,
        commandLabel: "Return receipt processing",
      }),
    [inventoryReturnReceiptCmd, runBusinessCommand]
  );

  const handleRecordPayment = useCallback(
    async (input: PaymentRecordInput) =>
      runBusinessCommand({
        controller: paymentRecordCmd,
        payload: {
          orderId: input.orderId,
          customerId: input.customerId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
        },
        workbookId: "00000000-0000-0000-0000-000000000004",
        refreshWorkbooks: [
          "00000000-0000-0000-0000-000000000004",
          "00000000-0000-0000-0000-000000000015",
        ],
        successMessage: `Payment of $${input.amount} recorded for order ${input.orderId}.`,
        commandLabel: "Payment recording",
      }),
    [paymentRecordCmd, runBusinessCommand]
  );

  const businessActionStatuses: BusinessActionStatusMap = {
    product: {
      state: productCreateCmd.state,
      commandId: productCreateCmd.commandId,
      error: productCreateCmd.error?.message || null,
      elapsedMs: productCreateCmd.elapsedMs,
      reset: productCreateCmd.refresh,
    },
    inventory: {
      state: inventoryAdjustCmd.state,
      commandId: inventoryAdjustCmd.commandId,
      error: inventoryAdjustCmd.error?.message || null,
      elapsedMs: inventoryAdjustCmd.elapsedMs,
      reset: inventoryAdjustCmd.refresh,
    },
    salesOrder: {
      state: salesOrderCreateCmd.state,
      commandId: salesOrderCreateCmd.commandId,
      error: salesOrderCreateCmd.error?.message || null,
      elapsedMs: salesOrderCreateCmd.elapsedMs,
      reset: salesOrderCreateCmd.refresh,
    },
    salesOrderConfirm: {
      state: salesOrderConfirmCmd.state,
      commandId: salesOrderConfirmCmd.commandId,
      error: salesOrderConfirmCmd.error?.message || null,
      elapsedMs: salesOrderConfirmCmd.elapsedMs,
      reset: salesOrderConfirmCmd.refresh,
    },
    fulfillmentAllocate: {
      state: fulfillmentAllocateCmd.state,
      commandId: fulfillmentAllocateCmd.commandId,
      error: fulfillmentAllocateCmd.error?.message || null,
      elapsedMs: fulfillmentAllocateCmd.elapsedMs,
      reset: fulfillmentAllocateCmd.refresh,
    },
    purchaseOrder: {
      state: purchaseOrderCreateCmd.state,
      commandId: purchaseOrderCreateCmd.commandId,
      error: purchaseOrderCreateCmd.error?.message || null,
      elapsedMs: purchaseOrderCreateCmd.elapsedMs,
      reset: purchaseOrderCreateCmd.refresh,
    },
    purchaseReceipt: {
      state: purchaseOrderReceiveCmd.state,
      commandId: purchaseOrderReceiveCmd.commandId,
      error: purchaseOrderReceiveCmd.error?.message || null,
      elapsedMs: purchaseOrderReceiveCmd.elapsedMs,
      reset: purchaseOrderReceiveCmd.refresh,
    },
    party: {
      state: partyCreateCmd.state,
      commandId: partyCreateCmd.commandId,
      error: partyCreateCmd.error?.message || null,
      elapsedMs: partyCreateCmd.elapsedMs,
      reset: partyCreateCmd.refresh,
    },
    inventoryReturnReceipt: {
      state: inventoryReturnReceiptCmd.state,
      commandId: inventoryReturnReceiptCmd.commandId,
      error: inventoryReturnReceiptCmd.error?.message || null,
      elapsedMs: inventoryReturnReceiptCmd.elapsedMs,
      reset: inventoryReturnReceiptCmd.refresh,
    },
    paymentRecord: {
      state: paymentRecordCmd.state,
      commandId: paymentRecordCmd.commandId,
      error: paymentRecordCmd.error?.message || null,
      elapsedMs: paymentRecordCmd.elapsedMs,
      reset: paymentRecordCmd.refresh,
    },
  };

  return {
    businessActionStatuses,
    handleCreateProduct,
    handleAdjustInventory,
    handleCreateSalesOrder,
    handleConfirmSalesOrder,
    handleAllocateFulfillment,
    handleCreatePurchaseOrder,
    handleReceivePurchaseOrder,
    handleCreateParty,
    handleReceiveReturn,
    handleRecordPayment,
  };
}