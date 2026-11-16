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

/** Baseline schema (idempotent), then numbered migrations in order, each applied once and recorded. */
export async function migrate(pool) {
  await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = new URL('../migrations/', import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  const applied = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  for (const f of files.filter((f) => !applied.has(f))) {
    await tx(pool, async (db) => {
      await db.query(fs.readFileSync(new URL(f, dir), 'utf8'));
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    });
  }
}

export async function setting(db, key) {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
  if (!rows.length) throw new Error(`missing setting ${key}`);
  return rows[0].value;
}
