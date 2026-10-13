import { Pool, type PoolClient, type QueryResultRow } from 'pg';

// This module is server-only. DATABASE_URL must never use a VITE_ prefix.
let pool: Pool | undefined;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for persistent Sub-Track storage');
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (error) => console.error('PostgreSQL idle connection error:', error));
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, [...params]);
  return result.rows;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
