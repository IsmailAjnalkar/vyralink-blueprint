// Recreates the E2E database (vyralink_e2e) on the local dev Postgres. Never points at anything but localhost.
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_e2e')) throw new Error(`refusing to reset ${url.host}${url.pathname}`);
const name = url.pathname.slice(1);
url.pathname = '/postgres';
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${name}`);
await admin.end();
console.log(`reset ${name}`);
