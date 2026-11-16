// Applies the schema (idempotent). Optional: ADMIN_EMAIL + ADMIN_PASSWORD create a platform super admin.
import { createPool, migrate } from './db.js';
import { hashPassword } from './http.js';

const pool = createPool();
await migrate(pool);
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  await pool.query(
    `INSERT INTO users (email, name, password_hash, is_super_admin) VALUES ($1, 'Platform admin', $2, true)
     ON CONFLICT (lower(email)) DO UPDATE SET is_super_admin = true`,
    [process.env.ADMIN_EMAIL, await hashPassword(process.env.ADMIN_PASSWORD)],
  );
  console.log(`super admin: ${process.env.ADMIN_EMAIL}`);
}
console.log('schema applied');
await pool.end();
