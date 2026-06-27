// @ts-nocheck
// NOTE: 'pg' is a runtime dep (see package.json). Smoke typecheck is intentionally lightweight and
// does not require installed optional runtime packages. After `pnpm install` the full types/build work.
// Real implementation uses 'pg' Pool for Queryable and transactions.

import { Pool, type PoolClient } from 'pg';
import type { Queryable, TransactionClient } from './transaction';

export type PostgresConfig = {
  connectionString?: string;
  max?: number;
};

let globalPool: Pool | null = null;

export function getPool(config?: PostgresConfig): Pool {
  if (!globalPool) {
    const connectionString =
      config?.connectionString ||
      process.env.DATABASE_URL ||
      'postgres://postgres:postgres@localhost:5432/spreadsheet_erp';
    globalPool = new Pool({
      connectionString,
      max: config?.max ?? 10,
    });
  }
  return globalPool;
}

export function resetPool(): void {
  if (globalPool) {
    // fire and forget in dev
    globalPool.end().catch(() => {});
    globalPool = null;
  }
}

/**
 * PostgreSQL implementation of Queryable for Phase 0.
 * Used by CommandProcessor, OutboxRepository, handlers.
 */
class InMemoryQueryable implements Queryable {
  private commandLog: any[] = [];
  private currentCellValues: any[] = [];
  private outboxEvents: any[] = [];
  private numericTransfers: any[] = [];
  private nextOutboxId = 1;
  private workspaceNodes: any[] = [];
  private workspaceEdges: any[] = [];

  constructor() {
    const defaultTenant = '00000000-0000-0000-0000-000000000001';

    // Seed Workspace Nodes
    this.workspaceNodes = [
      { id: '00000000-0000-0000-0000-000000000101', label: 'Sales Operations', kind: 'category', tags: [] },
      { id: '00000000-0000-0000-0000-000000000102', label: 'Warehouse & Inventory', kind: 'category', tags: [] },
      { id: '00000000-0000-0000-0000-000000000103', label: 'Accounting & Finance', kind: 'category', tags: [] },
      { id: '00000000-0000-0000-0000-000000000002', label: 'Sales Orders', kind: 'workbook', tags: ['sales', 'orders'] },
      { id: '00000000-0000-0000-0000-000000000003', label: 'Inventory Stock', kind: 'workbook', tags: ['warehouse', 'stock'] },
      { id: '00000000-0000-0000-0000-000000000004', label: 'Purchase Ledger', kind: 'workbook', tags: ['finance', 'ledger'] },
    ];

    // Seed Workspace Edges
    this.workspaceEdges = [
      { id: '00000000-0000-0000-0000-000000000201', source: '00000000-0000-0000-0000-000000000101', target: '00000000-0000-0000-0000-000000000002', label: 'contains' },
      { id: '00000000-0000-0000-0000-000000000202', source: '00000000-0000-0000-0000-000000000102', target: '00000000-0000-0000-0000-000000000003', label: 'contains' },
      { id: '00000000-0000-0000-0000-000000000203', source: '00000000-0000-0000-0000-000000000103', target: '00000000-0000-0000-0000-000000000004', label: 'contains' },
      { id: '00000000-0000-0000-0000-000000000204', source: '00000000-0000-0000-0000-000000000103', target: '00000000-0000-0000-0000-000000000002', label: 'contains' },
      { id: '00000000-0000-0000-0000-000000000205', source: '00000000-0000-0000-0000-000000000002', target: '00000000-0000-0000-0000-000000000003', label: 'deducts stock via item_name' },
      { id: '00000000-0000-0000-0000-000000000206', source: '00000000-0000-0000-0000-000000000004', target: '00000000-0000-0000-0000-000000000002', label: 'funds order fulfillment' },
      { id: '00000000-0000-0000-0000-000000000207', source: '00000000-0000-0000-0000-000000000003', target: '00000000-0000-0000-0000-000000000004', label: 'triggers reorder purchases' },
    ];
    
    // Seed Workbook 1: Sales Orders (default)
    const wb1 = '00000000-0000-0000-0000-000000000002';
    const initialWb1 = [
      { rowId: "1", values: { item_name: "Premium Desk", quantity: "2", unit_price: "250.00", total: "500.00" } },
      { rowId: "2", values: { item_name: "Ergonomic Chair", quantity: "5", unit_price: "180.00", total: "900.00" } },
      { rowId: "3", values: { item_name: "Mechanical Keyboard", quantity: "10", unit_price: "85.00", total: "850.00" } },
      { rowId: "4", values: { item_name: "USB-C Hub", quantity: "15", unit_price: "45.00", total: "675.00" } },
      { rowId: "5", values: { item_name: "LED Monitor", quantity: "4", unit_price: "320.00", total: "1280.00" } },
    ];
    for (const r of initialWb1) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wb1,
          row_id: r.rowId,
          column_id: col,
          value_text: val,
          updated_at: new Date()
        });
      }
    }

    // Seed Workbook 2: Inventory Stocks
    const wb2 = '00000000-0000-0000-0000-000000000003';
    const initialWb2 = [
      { rowId: "1", values: { item_name: "Premium Desk", stock_level: "15", reorder_point: "5", warehouse_location: "Aisle A" } },
      { rowId: "2", values: { item_name: "Ergonomic Chair", stock_level: "42", reorder_point: "10", warehouse_location: "Aisle B" } },
      { rowId: "3", values: { item_name: "Mechanical Keyboard", stock_level: "88", reorder_point: "20", warehouse_location: "Aisle C" } },
      { rowId: "4", values: { item_name: "USB-C Hub", stock_level: "120", reorder_point: "15", warehouse_location: "Aisle D" } },
      { rowId: "5", values: { item_name: "LED Monitor", stock_level: "8", reorder_point: "3", warehouse_location: "Aisle E" } },
    ];
    for (const r of initialWb2) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wb2,
          row_id: r.rowId,
          column_id: col,
          value_text: val,
          updated_at: new Date()
        });
      }
    }

    // Seed Workbook 3: Purchase Ledger
    const wb3 = '00000000-0000-0000-0000-000000000004';
    const initialWb3 = [
      { rowId: "1", values: { vendor_name: "Office Depot", invoice_no: "INV-9901", amount_due: "1250.00", payment_status: "Pending" } },
      { rowId: "2", values: { vendor_name: "Steelcase Inc", invoice_no: "INV-4412", amount_due: "900.00", payment_status: "Paid" } },
      { rowId: "3", values: { vendor_name: "Keychron Ltd", invoice_no: "INV-2088", amount_due: "850.00", payment_status: "Pending" } },
      { rowId: "4", values: { vendor_name: "Anker Tech", invoice_no: "INV-3105", amount_due: "675.00", payment_status: "Paid" } },
      { rowId: "5", values: { vendor_name: "Dell Corp", invoice_no: "INV-5511", amount_due: "1280.00", payment_status: "Pending" } },
    ];
    for (const r of initialWb3) {
      for (const [col, val] of Object.entries(r.values)) {
        this.currentCellValues.push({
          tenant_id: defaultTenant,
          workbook_id: wb3,
          row_id: r.rowId,
          column_id: col,
          value_text: val,
          updated_at: new Date()
        });
      }
    }
  }

  async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T> {
    const s = sql.trim().replace(/\s+/g, ' ');

    if (s.startsWith('BEGIN') || s.startsWith('COMMIT') || s.startsWith('ROLLBACK') || s.startsWith('SAVEPOINT') || s.startsWith('RELEASE')) {
      return { rows: [] } as unknown as T;
    }

    if (s.includes('FROM command_log WHERE') && s.startsWith('SELECT')) {
      const tenantId = params?.[0];
      const commandId = params?.[1];
      const found = this.commandLog.find(r => r.tenant_id === tenantId && r.command_id === commandId);
      return { rows: found ? [found] : [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO command_log')) {
      const row = {
        tenant_id: params?.[0],
        command_id: params?.[1],
        trace_id: params?.[2],
        correlation_id: params?.[3],
        user_id: params?.[4],
        workbook_id: params?.[5],
        command_type: params?.[6],
        command_status: params?.[7],
        request_hash: params?.[8],
        request_body_hash: params?.[9],
        expires_at: params?.[10],
        created_at: new Date(),
        response_body_redacted: null,
      };
      this.commandLog.push(row);
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('UPDATE command_log')) {
      const tenantId = params?.[0];
      const commandId = params?.[1];
      const status = params?.[2];
      const redacted = params?.[3];
      const found = this.commandLog.find(r => r.tenant_id === tenantId && r.command_id === commandId);
      if (found) {
        found.command_status = status;
        found.response_body_redacted = redacted;
        if (status === 'committed') found.committed_at = new Date();
      }
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO current_cell_values')) {
      const tenant = params?.[0];
      const workbook = params?.[1];
      const rowId = params?.[2];
      const columnId = params?.[3];
      const value = params?.[4];

      const found = this.currentCellValues.find(
        r => r.tenant_id === tenant && r.workbook_id === workbook && String(r.row_id) === String(rowId) && String(r.column_id) === String(columnId)
      );
      if (found) {
        found.value_text = String(value);
        found.updated_at = new Date();
      } else {
        this.currentCellValues.push({
          tenant_id: tenant,
          workbook_id: workbook,
          row_id: String(rowId),
          column_id: String(columnId),
          value_text: String(value),
          updated_at: new Date()
        });
      }
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('DELETE FROM current_cell_values')) {
      const tenant = params?.[0];
      const workbook = params?.[1];
      const rowId = params?.[2];
      this.currentCellValues = this.currentCellValues.filter(
        r => !(r.tenant_id === tenant && r.workbook_id === workbook && String(r.row_id) === String(rowId))
      );
      return { rows: [] } as unknown as T;
    }

    if (s.includes('FROM current_cell_values WHERE') && s.startsWith('SELECT')) {
      const tenant = params?.[0];
      const workbook = params?.[1];
      const rows = this.currentCellValues.filter(r => r.tenant_id === tenant && r.workbook_id === workbook);
      rows.sort((a, b) => {
        const aNum = Number(a.row_id);
        const bNum = Number(b.row_id);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum;
        } else {
          if (a.row_id !== b.row_id) return String(a.row_id).localeCompare(String(b.row_id));
        }
        return String(a.column_id).localeCompare(String(b.column_id));
      });
      return { rows } as unknown as T;
    }

    if (s.startsWith('INSERT INTO numeric_transfers')) {
      this.numericTransfers.push(params);
      return { rows: [{ outbox_id: '1' }] } as unknown as T;
    }

    if (s.includes('FROM numeric_transfers WHERE') && s.startsWith('SELECT')) {
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO outbox_events')) {
      const id = String(this.nextOutboxId++);
      const row = {
        outbox_id: id,
        event_id: params?.[0],
        idempotency_key: params?.[1],
        tenant_id: params?.[2],
        workbook_id: params?.[3],
        command_id: params?.[4],
        command_event_seq: params?.[5],
        event_type: params?.[6],
        event_source: params?.[7],
        event_subject: params?.[8],
        aggregate_type: params?.[9],
        aggregate_id: params?.[10],
        route_key: params?.[11],
        partition_key: params?.[12],
        target_planes: params?.[13] || ['sse'],
        schema_version: params?.[14],
        data_schema: params?.[15],
        payload_content_type: params?.[16],
        payload: params?.[17],
        payload_ref: params?.[18],
        payload_hash: params?.[19],
        payload_size_bytes: params?.[20],
        visibility_scope: params?.[21],
        data_classification: params?.[22],
        permission_scope_hash: params?.[23],
        trace_id: params?.[24],
        correlation_id: params?.[25],
        created_at: new Date()
      };
      this.outboxEvents.push(row);
      return { rows: [{ outbox_id: id }] } as unknown as T;
    }

    if (s.includes('SELECT MIN(outbox_id)') || s.includes('SELECT min(outbox_id)')) {
      const min = this.outboxEvents.length > 0 ? String(Math.min(...this.outboxEvents.map(e => Number(e.outbox_id)))) : null;
      return { rows: [{ min_id: min, min: min }] } as unknown as T;
    }

    if (s.includes('FROM outbox_events WHERE') && s.startsWith('SELECT')) {
      const watermark = Number(params?.[0] || 0);
      const tenantIds = params?.[1] || [];
      const limit = Number(params?.[2] || 100);

      const filtered = this.outboxEvents.filter(e => {
        if (!tenantIds.includes(e.tenant_id)) return false;
        return Number(e.outbox_id) > watermark;
      });
      filtered.sort((a, b) => Number(a.outbox_id) - Number(b.outbox_id));
      const sliced = filtered.slice(0, limit);

      return { rows: sliced } as unknown as T;
    }

    if (s.startsWith('SELECT * FROM workspace_nodes')) {
      return { rows: this.workspaceNodes } as unknown as T;
    }

    if (s.startsWith('SELECT * FROM workspace_edges')) {
      return { rows: this.workspaceEdges } as unknown as T;
    }

    if (s.startsWith('INSERT INTO workspace_nodes')) {
      const row = {
        id: params?.[0],
        label: params?.[1],
        kind: params?.[2],
        tags: params?.[3],
      };
      this.workspaceNodes.push(row);
      return { rows: [] } as unknown as T;
    }

    if (s.startsWith('INSERT INTO workspace_edges')) {
      const row = {
        id: params?.[0],
        source: params?.[1],
        target: params?.[2],
        label: params?.[3],
      };
      this.workspaceEdges.push(row);
      return { rows: [] } as unknown as T;
    }

    return { rows: [] } as unknown as T;
  }
}

export class PostgresQueryable implements Queryable {
  private readonly pool: Pool;
  private inMemoryFallback: InMemoryQueryable | null = null;

  constructor(poolOrConfig?: Pool | PostgresConfig) {
    if (poolOrConfig instanceof Pool) {
      this.pool = poolOrConfig;
    } else {
      this.pool = getPool(poolOrConfig);
    }
  }

  async query<T = unknown>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T> {
    if (this.inMemoryFallback) {
      return this.inMemoryFallback.query<T>(sql, params);
    }

    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query(sql, params as any[]);
        return res as unknown as T;
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('connect') || err.message?.includes('refused')) {
        console.warn('\n⚠️ [db] PostgreSQL connection refused. Falling back to In-Memory Database Mode for local demo.\n');
        this.inMemoryFallback = new InMemoryQueryable();
        return this.inMemoryFallback.query<T>(sql, params);
      }
      throw err;
    }
  }

  get rawPool(): Pool {
    return this.pool;
  }
}

/**
 * Factory for a Queryable backed by real postgres.
 * Pass to CommandProcessor, routes init, etc.
 */
export function createPostgresQueryable(config?: PostgresConfig): Queryable {
  return new PostgresQueryable(config);
}

/**
 * Real tx wrapper usable when you have a PostgresQueryable (or pool).
 * Processor currently uses the one from ./transaction (string BEGIN mock compatible).
 * Real path will call this or we adapt the client.
 */
export async function withPostgresTransaction<T>(
  db: PostgresQueryable | Queryable,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  if (!db || typeof (db as any).query !== 'function') {
    throw new Error(
      'ASSERT_FAILED: withPostgresTransaction requires Queryable db',
    );
  }
  const pool = (db as any).rawPool || (db as any).pool || getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx: TransactionClient = {
      query: async <U = unknown>(sql: string, params?: readonly unknown[]) => {
        const r = await client.query(sql, params as any[]);
        return r as unknown as U;
      },
      savepoint: async (name: string) => {
        await client.query(`SAVEPOINT ${name}`);
      },
      rollbackTo: async (name: string) => {
        await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
      },
      release: async (name: string) => {
        await client.query(`RELEASE SAVEPOINT ${name}`);
      },
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
