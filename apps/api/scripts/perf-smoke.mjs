// Performance smoke test: seeds a realistic volume (1,000 sellers, 300 completed sessions, 6,000 orders) into its own
// database (vyralink_perf), then times the heaviest read endpoints over HTTP with 10 requests in flight.
// Run: npm run perf -w @vyralink/api   (needs the local Postgres: npm run db:start)
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { migrate } from '../src/db.js';
import { sha256 } from '../src/http.js';

const BASE = process.env.TEST_DB_BASE ?? 'postgres://postgres:postgres@127.0.0.1:5441';
const TARGET_P95_MS = 500;

const admin = new pg.Client({ connectionString: `${BASE}/postgres` });
await admin.connect();
await admin.query('DROP DATABASE IF EXISTS vyralink_perf WITH (FORCE)');
await admin.query('CREATE DATABASE vyralink_perf');
await admin.end();
const pool = new pg.Pool({ connectionString: `${BASE}/vyralink_perf` });
await migrate(pool);

const t0 = Date.now();
/** @param {string} sql @param {unknown[]} [params] @returns {Promise<{ rows: any[] }>} */
const q = (sql, params) => pool.query(sql, params);
const { rows: [brand] } = await q(`INSERT INTO orgs (kind, name, status) VALUES ('brand', 'Perf Brand', 'verified') RETURNING id`);
const { rows: [ops] } = await q(`INSERT INTO orgs (kind, name, status) VALUES ('operator', 'Perf Studio', 'verified') RETURNING id`);
const user = async (email, role, org) => {
  const { rows: [u] } = await q(`INSERT INTO users (email, name, password_hash, email_verified_at) VALUES ($1, $1, 'x', now()) RETURNING id`, [email]);
  if (org) await q('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)', [org, u.id, role]);
  const token = randomBytes(24).toString('hex');
  await q(`INSERT INTO sessions (token_hash, user_id, expires_at, mfa_passed) VALUES ($1, $2, now() + interval '1 day', true)`, [sha256(token), u.id]);
  return token;
};
const brandToken = await user('owner@perf.test', 'brand_owner', brand.id);
const opsToken = await user('lm@perf.test', 'location_manager', ops.id);

const { rows: [loc] } = await q(`INSERT INTO locations (org_id, name, status) VALUES ($1, 'Perf Studio 1', 'open') RETURNING id`, [ops.id]);
await q(`INSERT INTO booths (location_id, name, type) SELECT $1, 'Booth ' || g, 'beauty' FROM generate_series(1, 20) g`, [loc.id]);
await q(`WITH u AS (INSERT INTO users (email, name, password_hash, email_verified_at) SELECT 'seller' || g || '@perf.test', 'Seller ' || g, 'x', now() FROM generate_series(1, 1000) g RETURNING id, name)
  INSERT INTO seller_profiles (user_id, display_name, categories, languages, rate_cents, identity_verified, payout_verified)
  SELECT id, name, ARRAY[(ARRAY['skincare', 'beauty', 'fashion', 'home'])[1 + (abs(hashtext(name)) % 4)]], ARRAY['English'], 2000 + abs(hashtext(name)) % 8000, true, true FROM u`);
const { rows: [prod] } = await q(`INSERT INTO products (org_id, name, sku, price_cents, category, status) VALUES ($1, 'Serum', 'P-1', 4000, 'skincare', 'approved') RETURNING id`, [brand.id]);
// 300 completed sessions, 4 h apart (3 h LIVE each), spread over 20 booths and the first 300 sellers.
await q(`WITH c AS (
    INSERT INTO campaigns (org_id, name, type, product_ids, location_id, starts_at, ends_at, base_rate_cents, commission_bps, production_fee_cents, performance_fee_bps, budget_cap_cents, status)
    SELECT $1, 'Campaign ' || g, 'live_shopping', ARRAY[$2::uuid], $3, now() - make_interval(hours => 4 * g + 24), now() - make_interval(hours => 4 * g + 21), 3000, 1000, 75000, 700, 200000, 'completed'
    FROM generate_series(1, 300) g RETURNING id, starts_at, ends_at, name)
  INSERT INTO bookings (booth_id, campaign_id, seller_id, starts_at, ends_at, slot, status, checkin_code, actual_start, actual_end, results_status)
  SELECT (SELECT id FROM booths WHERE location_id = $3 ORDER BY name OFFSET (substring(c.name from 10)::int % 20) LIMIT 1), c.id,
    (SELECT user_id FROM seller_profiles ORDER BY display_name OFFSET (substring(c.name from 10)::int % 300) LIMIT 1),
    c.starts_at, c.ends_at, tstzrange(c.starts_at - interval '30 minutes', c.ends_at + interval '15 minutes'), 'completed', 'VL-1234', c.starts_at, c.ends_at, 'imported'
  FROM c`, [brand.id, prod.id, loc.id]);
await q(`INSERT INTO session_orders (booking_id, order_id, placed_at, amount_cents, status, attributed)
  SELECT b.id, 'O' || g, b.starts_at + make_interval(mins => g * 5), 4000, CASE WHEN g % 17 = 0 THEN 'refunded' ELSE 'completed' END, g % 13 <> 0
  FROM bookings b, generate_series(1, 20) g`);
const { rows: [{ c: campaignId }] } = await q(`SELECT id AS c FROM campaigns WHERE org_id = $1 LIMIT 1`, [brand.id]);
console.log(`seeded in ${Date.now() - t0} ms`);

const app = buildApp({ pool, rateLimitScale: 1000 });
await app.listen({ port: 0, host: '127.0.0.1' });
const { port } = /** @type {import("node:net").AddressInfo} */ (app.server.address());
const base = `http://127.0.0.1:${port}/v1`;

async function measure(name, path, token, org, n = 100, concurrency = 10) {
  const times = [];
  let i = 0;
  const worker = async () => {
    while (i++ < n) {
      const s = performance.now();
      const res = await fetch(base + path, { headers: { authorization: `Bearer ${token}`, 'x-org-id': org } });
      await res.arrayBuffer();
      if (!res.ok) throw new Error(`${path} → ${res.status}`);
      times.push(performance.now() - s);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  times.sort((a, b) => a - b);
  const p = (x) => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * x))]);
  return { endpoint: name, p50_ms: p(0.5), p95_ms: p(0.95), max_ms: Math.round(times.at(-1)), ok: p(0.95) <= TARGET_P95_MS ? 'yes' : 'NO' };
}

const results = [
  await measure('GET /sellers (1,000 sellers, verified stats)', '/sellers', brandToken, brand.id),
  await measure('GET /campaigns/:id/matches', `/campaigns/${campaignId}/matches`, brandToken, brand.id),
  await measure('GET /campaigns (300)', '/campaigns', brandToken, brand.id),
  await measure('GET /analytics/brand (300 sessions)', '/analytics/brand', brandToken, brand.id, 30, 5),
  await measure('GET /analytics/studio', '/analytics/studio?days=365', opsToken, ops.id),
  await measure('GET /bookings (studio, 300)', '/bookings', opsToken, ops.id),
  await measure('GET /locations/:id/control-center', `/locations/${loc.id}/control-center`, opsToken, ops.id),
];
console.table(results);
await app.close();
await pool.end();
if (results.some((r) => r.ok === 'NO')) { console.log(`Some endpoints exceed the p95 target of ${TARGET_P95_MS} ms`); process.exitCode = 1; }
