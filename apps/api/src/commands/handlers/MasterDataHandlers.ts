import type { CommandEnvelope } from '@erp/domain/commands/types';
import { CommandHandlerBase } from '../CommandHandlerBase';
import type { CommandExecutionContext } from '../CommandHandlerBase';

// Extended master data command handlers (per sme-extended-variants-and-entities-spec.md)
// ProductTemplates, ProductVariants, Parties, Customers, Suppliers, Addresses
// All use current_cell_values cell-based facade. No ledger interaction for master data.

// --- Helper: upsert a single cell ---
async function upsertCell(
  tx: CommandExecutionContext['tx'],
  tenant: string,
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
    [tenant, workbookId, rowId, columnId, String(value)],
  );
}

// --- Helper: check if a row exists in a workbook (FK validation) ---
async function rowExists(
  tx: CommandExecutionContext['tx'],
  tenant: string,
  workbookId: string,
  rowId: string,
): Promise<boolean> {
  try {
    const res = await tx.query(
      `SELECT value_text FROM current_cell_values
       WHERE tenant_id = $1 AND workbook_id = $2 AND row_id = $3 LIMIT 1`,
      [tenant, workbookId, rowId],
    );
    const rows = (res as any)?.rows || res || [];
    return rows.length > 0;
  } catch {
    return false;
  }
}

// --- Helper: read a specific cell value ---
async function readCell(
  tx: CommandExecutionContext['tx'],
  tenant: string,
  workbookId: string,
  rowId: string,
  columnId: string,
): Promise<string | null> {
  try {
    const res = await tx.query(
      `SELECT value_text FROM current_cell_values
       WHERE tenant_id = $1 AND workbook_id = $2 AND row_id = $3 AND column_id = $4`,
      [tenant, workbookId, rowId, columnId],
    );
    const rows = (res as any)?.rows || res || [];
    if (rows.length > 0) return rows[0].value_text || null;
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// 1. ProductTemplate.create
// ============================================================

export type ProductTemplateCreatePayload = {
  templateId: string;
  name: string;
  description?: string;
  category?: string;
  basePrice: string;
  baseCost: string;
  defaultTaxRate?: string;
};

export class ProductTemplateCreateHandler extends CommandHandlerBase<
  ProductTemplateCreatePayload,
  { templateId: string }
> {
  readonly commandType = 'productTemplate.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<ProductTemplateCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ templateId: string }> {
    const { templateId, name, description = '', category = '', basePrice, baseCost, defaultTaxRate = '0' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000021';

    if (!templateId || !name) {
      throw new Error('ASSERT_FAILED: templateId and name required');
    }

    const cells: [string, string][] = [
      ['template_id', templateId],
      ['name', name],
      ['description', description],
      ['category', category],
      ['base_price', basePrice],
      ['base_cost', baseCost],
      ['default_tax_rate', defaultTaxRate],
    ];

    for (const [col, val] of cells) {
      await upsertCell(context.tx, tenant, workbookId, templateId, col, val);
    }

    return { templateId };
  }
}

// ============================================================
// 2. ProductVariant.create
// ============================================================

export type ProductVariantCreatePayload = {
  productId: string;
  templateId: string;
  optionColor?: string;
  optionSize?: string;
  priceDelta?: string;
  costDelta?: string;
};

export class ProductVariantCreateHandler extends CommandHandlerBase<
  ProductVariantCreatePayload,
  { productId: string; templateId: string }
> {
  readonly commandType = 'productVariant.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<ProductVariantCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ productId: string; templateId: string }> {
    const { productId, templateId, optionColor = '', optionSize = '', priceDelta = '0', costDelta = '0' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000022';
    const templateWb = '00000000-0000-0000-0000-000000000021';

    if (!productId || !templateId) {
      throw new Error('ASSERT_FAILED: productId and templateId required');
    }

    // Referential integrity: template must exist
    const templateExists = await rowExists(context.tx, tenant, templateWb, templateId);
    if (!templateExists) {
      throw new Error('REF_INTEGRITY: template_id not found in ProductTemplates');
    }

    // Invariant: base_price + price_delta >= 0
    const basePrice = await readCell(context.tx, tenant, templateWb, templateId, 'base_price');
    const totalPrice = (parseFloat(basePrice || '0') + parseFloat(priceDelta));
    if (totalPrice < 0) {
      throw new Error('PRICE_NEGATIVE: base_price + price_delta must be >= 0');
    }

    const cells: [string, string][] = [
      ['product_id', productId],
      ['template_id', templateId],
      ['option_color', optionColor],
      ['option_size', optionSize],
      ['price_delta', priceDelta],
      ['cost_delta', costDelta],
      ['active', 'Y'],
    ];

    for (const [col, val] of cells) {
      await upsertCell(context.tx, tenant, workbookId, productId, col, val);
    }

    return { productId, templateId };
  }
}

// ============================================================
// 3. Party.create (with optional Customer/Supplier creation)
// ============================================================

export type PartyCreatePayload = {
  partyId: string;
  legalName: string;
  taxId?: string;
  email?: string;
  phone?: string;
  asCustomer?: { creditLimit: string; paymentTerms: string };
  asSupplier?: { leadTimeDays: string; paymentTerms: string };
};

export class PartyCreateHandler extends CommandHandlerBase<
  PartyCreatePayload,
  { partyId: string; customerId?: string; supplierId?: string }
> {
  readonly commandType = 'party.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<PartyCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ partyId: string; customerId?: string; supplierId?: string }> {
    const { partyId, legalName, taxId = '', email = '', phone = '', asCustomer, asSupplier } = envelope.payload;
    const tenant = envelope.tenantId;
    const partiesWb = envelope.workbookId || '00000000-0000-0000-0000-000000000023';
    const customersWb = '00000000-0000-0000-0000-000000000024';
    const suppliersWb = '00000000-0000-0000-0000-000000000025';

    if (!partyId || !legalName) {
      throw new Error('ASSERT_FAILED: partyId and legalName required');
    }

    // Write party cells
    const partyCells: [string, string][] = [
      ['party_id', partyId],
      ['legal_name', legalName],
      ['tax_id', taxId],
      ['email', email],
      ['phone', phone],
    ];
    for (const [col, val] of partyCells) {
      await upsertCell(context.tx, tenant, partiesWb, partyId, col, val);
    }

    let customerId: string | undefined;
    let supplierId: string | undefined;

    // Optionally create Customer record
    if (asCustomer) {
      customerId = `CUST-${partyId}`;
      const custCells: [string, string][] = [
        ['customer_id', customerId],
        ['party_id', partyId],
        ['credit_limit', asCustomer.creditLimit],
        ['payment_terms', asCustomer.paymentTerms],
      ];
      for (const [col, val] of custCells) {
        await upsertCell(context.tx, tenant, customersWb, customerId, col, val);
      }
    }

    // Optionally create Supplier record
    if (asSupplier) {
      supplierId = `SUPP-${partyId}`;
      const suppCells: [string, string][] = [
        ['supplier_id', supplierId],
        ['party_id', partyId],
        ['lead_time_days', asSupplier.leadTimeDays],
        ['payment_terms', asSupplier.paymentTerms],
      ];
      for (const [col, val] of suppCells) {
        await upsertCell(context.tx, tenant, suppliersWb, supplierId, col, val);
      }
    }

    const resObj: { partyId: string; customerId?: string; supplierId?: string } = { partyId };
    if (customerId) resObj.customerId = customerId;
    if (supplierId) resObj.supplierId = supplierId;
    return resObj;
  }
}

// ============================================================
// 4. Customer.create (standalone, requires Party FK)
// ============================================================

export type CustomerCreatePayload = {
  customerId: string;
  partyId: string;
  creditLimit?: string;
  paymentTerms?: string;
};

export class CustomerCreateHandler extends CommandHandlerBase<
  CustomerCreatePayload,
  { customerId: string }
> {
  readonly commandType = 'customer.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<CustomerCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ customerId: string }> {
    const { customerId, partyId, creditLimit = '0', paymentTerms = 'NET30' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000024';
    const partiesWb = '00000000-0000-0000-0000-000000000023';

    if (!customerId || !partyId) {
      throw new Error('ASSERT_FAILED: customerId and partyId required');
    }

    // Referential integrity: party must exist
    const partyExists = await rowExists(context.tx, tenant, partiesWb, partyId);
    if (!partyExists) {
      throw new Error('REF_INTEGRITY: party_id not found in Parties');
    }

    const cells: [string, string][] = [
      ['customer_id', customerId],
      ['party_id', partyId],
      ['credit_limit', creditLimit],
      ['payment_terms', paymentTerms],
    ];

    for (const [col, val] of cells) {
      await upsertCell(context.tx, tenant, workbookId, customerId, col, val);
    }

    return { customerId };
  }
}

// ============================================================
// 5. Supplier.create (standalone, requires Party FK)
// ============================================================

export type SupplierCreatePayload = {
  supplierId: string;
  partyId: string;
  leadTimeDays?: string;
  paymentTerms?: string;
};

export class SupplierCreateHandler extends CommandHandlerBase<
  SupplierCreatePayload,
  { supplierId: string }
> {
  readonly commandType = 'supplier.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<SupplierCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ supplierId: string }> {
    const { supplierId, partyId, leadTimeDays = '0', paymentTerms = 'NET30' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000025';
    const partiesWb = '00000000-0000-0000-0000-000000000023';

    if (!supplierId || !partyId) {
      throw new Error('ASSERT_FAILED: supplierId and partyId required');
    }

    // Referential integrity: party must exist
    const partyExists = await rowExists(context.tx, tenant, partiesWb, partyId);
    if (!partyExists) {
      throw new Error('REF_INTEGRITY: party_id not found in Parties');
    }

    const cells: [string, string][] = [
      ['supplier_id', supplierId],
      ['party_id', partyId],
      ['lead_time_days', leadTimeDays],
      ['payment_terms', paymentTerms],
    ];

    for (const [col, val] of cells) {
      await upsertCell(context.tx, tenant, workbookId, supplierId, col, val);
    }

    return { supplierId };
  }
}

// ============================================================
// 6. Address.create (requires Party FK)
// ============================================================

export type AddressCreatePayload = {
  addressId: string;
  partyId: string;
  addressType: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

export class AddressCreateHandler extends CommandHandlerBase<
  AddressCreatePayload,
  { addressId: string }
> {
  readonly commandType = 'address.create';

  async executeBusinessLogic(
    envelope: CommandEnvelope<AddressCreatePayload>,
    context: CommandExecutionContext,
  ): Promise<{ addressId: string }> {
    const { addressId, partyId, addressType, street = '', city = '', postalCode = '', country = '' } = envelope.payload;
    const tenant = envelope.tenantId;
    const workbookId = envelope.workbookId || '00000000-0000-0000-0000-000000000026';
    const partiesWb = '00000000-0000-0000-0000-000000000023';

    if (!addressId || !partyId || !addressType) {
      throw new Error('ASSERT_FAILED: addressId, partyId, and addressType required');
    }

    // Validate addressType enum
    if (addressType !== 'BILLING' && addressType !== 'SHIPPING') {
      throw new Error('VALIDATION: addressType must be BILLING or SHIPPING');
    }

    // Referential integrity: party must exist
    const partyExists = await rowExists(context.tx, tenant, partiesWb, partyId);
    if (!partyExists) {
      throw new Error('REF_INTEGRITY: party_id not found in Parties');
    }

    const cells: [string, string][] = [
      ['address_id', addressId],
      ['party_id', partyId],
      ['address_type', addressType],
      ['street', street],
      ['city', city],
      ['postal_code', postalCode],
      ['country', country],
    ];

    for (const [col, val] of cells) {
      await upsertCell(context.tx, tenant, workbookId, addressId, col, val);
    }

    return { addressId };
  }
}
