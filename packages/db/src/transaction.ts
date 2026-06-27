export interface Queryable {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
}

export interface TransactionClient extends Queryable {
  savepoint(name: string): Promise<void>;
  rollbackTo(name: string): Promise<void>;
  release(name: string): Promise<void>;
}

export async function withTransaction<T>(
  client: Queryable,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  if (!client || typeof client.query !== 'function') {
    throw new Error('ASSERT_FAILED: withTransaction requires Queryable client');
  }
  await client.query('BEGIN');
  const tx: TransactionClient = {
    query: client.query.bind(client),
    savepoint: (name) => client.query(`SAVEPOINT ${name}`) as Promise<void>,
    rollbackTo: (name) =>
      client.query(`ROLLBACK TO SAVEPOINT ${name}`) as Promise<void>,
    release: (name) =>
      client.query(`RELEASE SAVEPOINT ${name}`) as Promise<void>,
  };
  try {
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
