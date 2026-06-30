import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { CommandLifecycleState } from "../lib/useCommand";

const INVENTORY_WORKBOOK_ID = "00000000-0000-0000-0000-000000000014";
const SALES_ORDERS_WORKBOOK_ID = "00000000-0000-0000-0000-000000000015";
const PURCHASE_ORDERS_WORKBOOK_ID = "00000000-0000-0000-0000-000000000016";

const MASTER_DATA_WORKBOOK_IDS = new Set<string>([
  "00000000-0000-0000-0000-000000000010",
  "00000000-0000-0000-0000-000000000011",
  "00000000-0000-0000-0000-000000000012",
  "00000000-0000-0000-0000-000000000013",
  "00000000-0000-0000-0000-000000000023",
  "00000000-0000-0000-0000-000000000024",
  "00000000-0000-0000-0000-000000000025",
  "00000000-0000-0000-0000-000000000026",
]);

export type ProductCreateInput = {
  productId: string;
  sku: string;
  name: string;
  unitPrice: string;
  cost: string;
  taxRate: string;
};

export type InventoryAdjustInput = {
  productId: string;
  warehouseId: string;
  delta: string;
  reason: string;
};

export type SalesOrderCreateInput = {
  orderId: string;
  customerId: string;
  productId: string;
  qty: string;
  unitPrice: string;
  status: string;
};

export type SalesOrderConfirmInput = {
  orderId: string;
};

export type PurchaseOrderCreateInput = {
  poId: string;
  supplierId: string;
  productId: string;
  qtyOrdered: string;
  unitPrice: string;
  status: string;
};

export type PurchaseOrderReceiveInput = {
  poId: string;
  poLineId: string;
  receiptId: string;
  productId: string;
  warehouseId: string;
  qtyReceived: string;
  unitCost: string;
};

export type PartyCreateInput = {
  partyId: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  asCustomer: boolean;
  creditLimit: string;
  asSupplier: boolean;
  leadTimeDays: string;
  paymentTerms: string;
};

export type BusinessActionStatus = {
  state: CommandLifecycleState;
  commandId: string | null;
  error: string | null;
  elapsedMs: number;
  reset: () => void;
};

export type BusinessActionStatusMap = {
  product: BusinessActionStatus;
  inventory: BusinessActionStatus;
  salesOrder: BusinessActionStatus;
  salesOrderConfirm: BusinessActionStatus;
  purchaseOrder: BusinessActionStatus;
  purchaseReceipt: BusinessActionStatus;
  party: BusinessActionStatus;
};

type BusinessCommandCenterProps = {
  activeWorkbookId: string;
  statuses: BusinessActionStatusMap;
  onCreateProduct: (input: ProductCreateInput) => Promise<boolean>;
  onAdjustInventory: (input: InventoryAdjustInput) => Promise<boolean>;
  onCreateSalesOrder: (input: SalesOrderCreateInput) => Promise<boolean>;
  onConfirmSalesOrder: (input: SalesOrderConfirmInput) => Promise<boolean>;
  onCreatePurchaseOrder: (input: PurchaseOrderCreateInput) => Promise<boolean>;
  onReceivePurchaseOrder: (input: PurchaseOrderReceiveInput) => Promise<boolean>;
  onCreateParty: (input: PartyCreateInput) => Promise<boolean>;
};

type SectionKey = "product" | "inventory" | "salesOrder" | "purchaseOrder" | "party";

function actionTone(state: CommandLifecycleState): { label: string; color: string } {
  switch (state) {
    case "committed":
      return { label: "Committed", color: "var(--color-success, #0f766e)" };
    case "command_pending":
    case "locally_pending":
      return { label: "Pending", color: "var(--color-warning, #b45309)" };
    case "rejected":
      return { label: "Rejected", color: "var(--color-danger, #b91c1c)" };
    case "failed":
      return { label: "Failed", color: "var(--color-danger, #b91c1c)" };
    case "ambiguous_requires_refresh":
      return { label: "Needs refresh", color: "var(--color-warning, #b45309)" };
    default:
      return { label: "Ready", color: "var(--color-text-muted, #64748b)" };
  }
}

function ActionStatusCard({ title, status }: { title: string; status: BusinessActionStatus }) {
  const tone = actionTone(status.state);

  return (
    <div
      style={{
        border: `1px solid ${tone.color}`,
        borderRadius: "10px",
        padding: "12px",
        background: "var(--color-surface-elevated, rgba(15, 23, 42, 0.04))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
        <strong style={{ fontSize: "13px" }}>{title}</strong>
        <span style={{ fontSize: "12px", color: tone.color }}>{tone.label}</span>
      </div>
      {status.commandId && (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
          Command {status.commandId.slice(0, 8)}
        </p>
      )}
      {(status.state === "command_pending" || status.state === "locally_pending") && (
        <p style={{ margin: "8px 0 0", fontSize: "12px" }}>
          Waiting {Math.round(status.elapsedMs / 100) / 10}s
        </p>
      )}
      {status.error && (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--color-danger, #b91c1c)" }}>
          {status.error}
        </p>
      )}
      {status.state === "ambiguous_requires_refresh" && (
        <button type="button" className="btn btn--ghost" onClick={status.reset} style={{ marginTop: "8px" }}>
          Reset after refresh
        </button>
      )}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.35))",
        borderRadius: "12px",
        padding: "14px",
        display: "grid",
        gap: "10px",
      }}
    >
      <div>
        <h3 style={{ margin: 0, fontSize: "14px" }}>{title}</h3>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "number";
}) {
  return (
    <label style={{ display: "grid", gap: "4px", fontSize: "12px", fontWeight: 600 }}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ minWidth: 0, padding: "8px", borderRadius: "8px", border: "1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.35))" }}
      />
    </label>
  );
}

function ActionForm({
  submitLabel,
  onSubmit,
  children,
}: {
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "10px" }}>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {children}
      </div>
      <div>
        <button type="submit" className="btn">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function BusinessCommandCenter({
  activeWorkbookId,
  statuses,
  onCreateProduct,
  onAdjustInventory,
  onCreateSalesOrder,
  onConfirmSalesOrder,
  onCreatePurchaseOrder,
  onReceivePurchaseOrder,
  onCreateParty,
}: BusinessCommandCenterProps) {
  const [product, setProduct] = useState<ProductCreateInput>({
    productId: "",
    sku: "",
    name: "",
    unitPrice: "0",
    cost: "0",
    taxRate: "0",
  });
  const [inventory, setInventory] = useState<InventoryAdjustInput>({
    productId: "",
    warehouseId: "",
    delta: "1",
    reason: "manual-adjustment",
  });
  const [salesOrder, setSalesOrder] = useState<SalesOrderCreateInput>({
    orderId: "",
    customerId: "",
    productId: "",
    qty: "1",
    unitPrice: "0",
    status: "DRAFT",
  });
  const [salesOrderConfirm, setSalesOrderConfirm] = useState<SalesOrderConfirmInput>({
    orderId: "",
  });
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderCreateInput>({
    poId: "",
    supplierId: "",
    productId: "",
    qtyOrdered: "1",
    unitPrice: "0",
    status: "DRAFT",
  });
  const [purchaseReceipt, setPurchaseReceipt] = useState<PurchaseOrderReceiveInput>({
    poId: "",
    poLineId: "1",
    receiptId: "",
    productId: "",
    warehouseId: "",
    qtyReceived: "1",
    unitCost: "0",
  });
  const [party, setParty] = useState<PartyCreateInput>({
    partyId: "",
    legalName: "",
    taxId: "",
    email: "",
    phone: "",
    asCustomer: true,
    creditLimit: "0",
    asSupplier: false,
    leadTimeDays: "0",
    paymentTerms: "NET30",
  });

  const visibleSections = useMemo<SectionKey[]>(() => {
    if (activeWorkbookId === INVENTORY_WORKBOOK_ID) {
      return ["inventory", "product"];
    }
    if (activeWorkbookId === SALES_ORDERS_WORKBOOK_ID) {
      return ["salesOrder", "party"];
    }
    if (activeWorkbookId === PURCHASE_ORDERS_WORKBOOK_ID) {
      return ["purchaseOrder", "party"];
    }
    if (MASTER_DATA_WORKBOOK_IDS.has(activeWorkbookId)) {
      return ["product", "party"];
    }

    return ["product", "inventory", "salesOrder", "purchaseOrder", "party"];
  }, [activeWorkbookId]);

  return (
    <div style={{ display: "grid", gap: "14px", alignContent: "start" }}>
      <div style={{ display: "grid", gap: "6px" }}>
        <h2 style={{ margin: 0, fontSize: "15px" }}>Business Actions</h2>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted, #64748b)" }}>
          Use the existing command handlers to create catalog, party, sales, inventory, and procurement records from the workspace.
        </p>
      </div>

      {visibleSections.includes("product") && (
        <>
          <SectionCard
            title="Product Catalog"
            description="Create a product record in the Products workbook with pricing and tax defaults."
          >
            <ActionForm
              submitLabel="Create product"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onCreateProduct(product)) {
                  setProduct({ productId: "", sku: "", name: "", unitPrice: "0", cost: "0", taxRate: "0" });
                }
              }}
            >
              <LabeledInput label="Product ID" value={product.productId} onChange={(value) => setProduct((prev) => ({ ...prev, productId: value }))} placeholder="PROD-0001" />
              <LabeledInput label="SKU" value={product.sku} onChange={(value) => setProduct((prev) => ({ ...prev, sku: value }))} placeholder="SKU-001" />
              <LabeledInput label="Name" value={product.name} onChange={(value) => setProduct((prev) => ({ ...prev, name: value }))} placeholder="Trail shoes" />
              <LabeledInput label="Unit Price" value={product.unitPrice} onChange={(value) => setProduct((prev) => ({ ...prev, unitPrice: value }))} type="number" />
              <LabeledInput label="Standard Cost" value={product.cost} onChange={(value) => setProduct((prev) => ({ ...prev, cost: value }))} type="number" />
              <LabeledInput label="Tax Rate" value={product.taxRate} onChange={(value) => setProduct((prev) => ({ ...prev, taxRate: value }))} type="number" />
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="Product create" status={statuses.product} />
        </>
      )}

      {visibleSections.includes("inventory") && (
        <>
          <SectionCard
            title="Warehouse Adjustment"
            description="Adjust on-hand inventory through the existing inventory.adjust backend flow."
          >
            <ActionForm
              submitLabel="Adjust inventory"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onAdjustInventory(inventory)) {
                  setInventory({ productId: "", warehouseId: "", delta: "1", reason: "manual-adjustment" });
                }
              }}
            >
              <LabeledInput label="Product ID" value={inventory.productId} onChange={(value) => setInventory((prev) => ({ ...prev, productId: value }))} placeholder="p1" />
              <LabeledInput label="Warehouse ID" value={inventory.warehouseId} onChange={(value) => setInventory((prev) => ({ ...prev, warehouseId: value }))} placeholder="w1" />
              <LabeledInput label="Delta" value={inventory.delta} onChange={(value) => setInventory((prev) => ({ ...prev, delta: value }))} type="number" />
              <LabeledInput label="Reason" value={inventory.reason} onChange={(value) => setInventory((prev) => ({ ...prev, reason: value }))} placeholder="cycle-count" />
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="Inventory adjust" status={statuses.inventory} />
        </>
      )}

      {visibleSections.includes("salesOrder") && (
        <>
          <SectionCard
            title="Sales Order Entry"
            description="Create a one-line sales order in the Sales Orders workbook."
          >
            <ActionForm
              submitLabel="Create sales order"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onCreateSalesOrder(salesOrder)) {
                  setSalesOrder({ orderId: "", customerId: "", productId: "", qty: "1", unitPrice: "0", status: "DRAFT" });
                }
              }}
            >
              <LabeledInput label="Order ID" value={salesOrder.orderId} onChange={(value) => setSalesOrder((prev) => ({ ...prev, orderId: value }))} placeholder="SO-001" />
              <LabeledInput label="Customer ID" value={salesOrder.customerId} onChange={(value) => setSalesOrder((prev) => ({ ...prev, customerId: value }))} placeholder="CUST-PARTY-001" />
              <LabeledInput label="Product ID" value={salesOrder.productId} onChange={(value) => setSalesOrder((prev) => ({ ...prev, productId: value }))} placeholder="PROD-0001" />
              <LabeledInput label="Qty" value={salesOrder.qty} onChange={(value) => setSalesOrder((prev) => ({ ...prev, qty: value }))} type="number" />
              <LabeledInput label="Unit Price" value={salesOrder.unitPrice} onChange={(value) => setSalesOrder((prev) => ({ ...prev, unitPrice: value }))} type="number" />
              <LabeledInput label="Status" value={salesOrder.status} onChange={(value) => setSalesOrder((prev) => ({ ...prev, status: value }))} placeholder="DRAFT" />
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="Sales order create" status={statuses.salesOrder} />

          <SectionCard
            title="Sales Order Confirmation"
            description="Confirm a draft sales order and transition all order lines plus the order header to CONFIRMED."
          >
            <ActionForm
              submitLabel="Confirm sales order"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onConfirmSalesOrder(salesOrderConfirm)) {
                  setSalesOrderConfirm({ orderId: "" });
                }
              }}
            >
              <LabeledInput label="Order ID" value={salesOrderConfirm.orderId} onChange={(value) => setSalesOrderConfirm({ orderId: value })} placeholder="SO-001" />
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="Sales order confirm" status={statuses.salesOrderConfirm} />
        </>
      )}

      {visibleSections.includes("purchaseOrder") && (
        <>
          <SectionCard
            title="Procurement"
            description="Create a one-line purchase order in the Purchase Orders workbook."
          >
            <ActionForm
              submitLabel="Create purchase order"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onCreatePurchaseOrder(purchaseOrder)) {
                  setPurchaseOrder({ poId: "", supplierId: "", productId: "", qtyOrdered: "1", unitPrice: "0", status: "DRAFT" });
                }
              }}
            >
              <LabeledInput label="PO ID" value={purchaseOrder.poId} onChange={(value) => setPurchaseOrder((prev) => ({ ...prev, poId: value }))} placeholder="PO-001" />
              <LabeledInput label="Supplier ID" value={purchaseOrder.supplierId} onChange={(value) => setPurchaseOrder((prev) => ({ ...prev, supplierId: value }))} placeholder="SUPP-PARTY-001" />
              <LabeledInput label="Product ID" value={purchaseOrder.productId} onChange={(value) => setPurchaseOrder((prev) => ({ ...prev, productId: value }))} placeholder="PROD-0001" />
              <LabeledInput label="Qty Ordered" value={purchaseOrder.qtyOrdered} onChange={(value) => setPurchaseOrder((prev) => ({ ...prev, qtyOrdered: value }))} type="number" />
              <LabeledInput label="Unit Price" value={purchaseOrder.unitPrice} onChange={(value) => setPurchaseOrder((prev) => ({ ...prev, unitPrice: value }))} type="number" />
              <LabeledInput label="Status" value={purchaseOrder.status} onChange={(value) => setPurchaseOrder((prev) => ({ ...prev, status: value }))} placeholder="DRAFT" />
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="Purchase order create" status={statuses.purchaseOrder} />

          <SectionCard
            title="Receive Against PO"
            description="Receive quantity from an existing PO line and update both the purchase and inventory workbooks."
          >
            <ActionForm
              submitLabel="Receive purchase order"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onReceivePurchaseOrder(purchaseReceipt)) {
                  setPurchaseReceipt({
                    poId: "",
                    poLineId: "1",
                    receiptId: "",
                    productId: "",
                    warehouseId: "",
                    qtyReceived: "1",
                    unitCost: "0",
                  });
                }
              }}
            >
              <LabeledInput label="PO ID" value={purchaseReceipt.poId} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, poId: value }))} placeholder="PO-001" />
              <LabeledInput label="PO Line ID" value={purchaseReceipt.poLineId} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, poLineId: value }))} placeholder="1" />
              <LabeledInput label="Receipt ID" value={purchaseReceipt.receiptId} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, receiptId: value }))} placeholder="RCV-001" />
              <LabeledInput label="Product ID" value={purchaseReceipt.productId} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, productId: value }))} placeholder="PROD-0001" />
              <LabeledInput label="Warehouse ID" value={purchaseReceipt.warehouseId} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, warehouseId: value }))} placeholder="w1" />
              <LabeledInput label="Qty Received" value={purchaseReceipt.qtyReceived} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, qtyReceived: value }))} type="number" />
              <LabeledInput label="Unit Cost" value={purchaseReceipt.unitCost} onChange={(value) => setPurchaseReceipt((prev) => ({ ...prev, unitCost: value }))} type="number" />
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="PO receipt" status={statuses.purchaseReceipt} />
        </>
      )}

      {visibleSections.includes("party") && (
        <>
          <SectionCard
            title="Party Setup"
            description="Create a party and optionally provision customer and supplier roles in the extended master-data workbooks."
          >
            <ActionForm
              submitLabel="Create party"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await onCreateParty(party)) {
                  setParty({
                    partyId: "",
                    legalName: "",
                    taxId: "",
                    email: "",
                    phone: "",
                    asCustomer: true,
                    creditLimit: "0",
                    asSupplier: false,
                    leadTimeDays: "0",
                    paymentTerms: "NET30",
                  });
                }
              }}
            >
              <LabeledInput label="Party ID" value={party.partyId} onChange={(value) => setParty((prev) => ({ ...prev, partyId: value }))} placeholder="PARTY-001" />
              <LabeledInput label="Legal Name" value={party.legalName} onChange={(value) => setParty((prev) => ({ ...prev, legalName: value }))} placeholder="Northwind Retail" />
              <LabeledInput label="Tax ID" value={party.taxId} onChange={(value) => setParty((prev) => ({ ...prev, taxId: value }))} placeholder="TIN-001" />
              <LabeledInput label="Email" value={party.email} onChange={(value) => setParty((prev) => ({ ...prev, email: value }))} placeholder="ops@example.com" type="email" />
              <LabeledInput label="Phone" value={party.phone} onChange={(value) => setParty((prev) => ({ ...prev, phone: value }))} placeholder="+1 555 0100" />
              <LabeledInput label="Credit Limit" value={party.creditLimit} onChange={(value) => setParty((prev) => ({ ...prev, creditLimit: value }))} type="number" />
              <LabeledInput label="Lead Time Days" value={party.leadTimeDays} onChange={(value) => setParty((prev) => ({ ...prev, leadTimeDays: value }))} type="number" />
              <LabeledInput label="Payment Terms" value={party.paymentTerms} onChange={(value) => setParty((prev) => ({ ...prev, paymentTerms: value }))} placeholder="NET30" />
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600 }}>
                <input type="checkbox" checked={party.asCustomer} onChange={(e) => setParty((prev) => ({ ...prev, asCustomer: e.target.checked }))} />
                Provision customer role
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600 }}>
                <input type="checkbox" checked={party.asSupplier} onChange={(e) => setParty((prev) => ({ ...prev, asSupplier: e.target.checked }))} />
                Provision supplier role
              </label>
            </ActionForm>
          </SectionCard>
          <ActionStatusCard title="Party create" status={statuses.party} />
        </>
      )}
    </div>
  );
}