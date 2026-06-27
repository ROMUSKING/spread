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
export class PostgresQueryable implements Queryable {
  private readonly pool: Pool;

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
    const client = await this.pool.connect();
    try {
      const res = await client.query(sql, params as any[]);
      return res as unknown as T;
    } finally {
      client.release();
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
