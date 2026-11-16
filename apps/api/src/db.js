import fs from 'node:fs';
import pg from 'pg';

export const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:5441/vyralink';

export function createPool(url = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  return new pg.Pool({ connectionString: url, max: 10 });
}

/** Runs fn(client) in a transaction; rolls back on throw. */
export async function tx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate(pool) {
  await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
}

export async function setting(db, key) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
  if (!rows.length) throw new Error(`missing setting ${key}`);
  return rows[0].value;
}
