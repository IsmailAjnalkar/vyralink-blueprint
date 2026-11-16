// External integrations, one switch each. Real providers need accounts that don't exist yet (docs/DEPLOYMENT.md);
// until then the sandbox / dev implementations run, are labelled as such everywhere, and refuse to start in production.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { HttpError } from './http.js';

const CHOICES = {
  payments: { sandbox: 'sandbox', stripe: 'blocked' },        // Stripe: no account
  email: { dev: 'dev', smtp: 'blocked' },                     // no email provider account
  storage: { local: 'dev', s3: 'blocked' },                   // no bucket
  orders: { csv: 'manual', sandbox: 'sandbox', tiktok_shop: 'blocked' }, // no TikTok Shop partner approval
};
const DEFAULTS = { payments: 'sandbox', email: 'dev', storage: 'local', orders: 'csv' };
const DETAIL = {
  'payments:sandbox': 'Simulated: invoices are marked paid and payouts sent by finance staff; nothing leaves the platform.',
  'payments:stripe': 'Blocked: needs a Stripe account (keys + PAYMENTS_WEBHOOK_SECRET). The signed webhook handler is ready.',
  'email:dev': 'Development outbox: emails are written to DEV_MAIL_DIR, not sent.',
  'email:smtp': 'Blocked: needs an email provider account.',
  'storage:local': 'Local disk (STORAGE_DIR). Fine for one machine; not for several servers.',
  'storage:s3': 'Blocked: needs an S3-compatible bucket.',
  'orders:csv': 'Manual: studio staff import the TikTok Shop order report (CSV).',
  'orders:sandbox': 'Sandbox: generates clearly labelled demo orders. Development and test only.',
  'orders:tiktok_shop': 'Blocked: needs approved TikTok Shop partner access. Import the CSV instead.',
};

/** Which provider each integration uses (environment), with its status. */
export function integrations(env = process.env) {
  return Object.keys(CHOICES).map((name) => {
    const provider = env[`${name.toUpperCase()}_PROVIDER`] ?? DEFAULTS[name];
    const status = CHOICES[name][provider];
    if (!status) throw new Error(`${name.toUpperCase()}_PROVIDER must be one of: ${Object.keys(CHOICES[name]).join(', ')}`);
    return { name, provider, status, detail: DETAIL[`${name}:${provider}`] };
  });
}
export const provider = (name, env = process.env) => integrations(env).find((i) => i.name === name).provider;

/** Called at startup: production never runs on simulated payments, a dev outbox, local-only files or demo orders, nor on a provider that isn't connected. */
export function assertProductionReady(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const bad = integrations(env).filter((i) => ['sandbox', 'dev', 'blocked'].includes(i.status));
  if (bad.length) throw new Error(`Not ready for production: ${bad.map((i) => `${i.name}=${i.provider} (${i.status})`).join(', ')}. See docs/DEPLOYMENT.md.`);
}

// ---------------------------------------------------------------- file storage
/** Local-disk storage. ponytail: single machine only; an S3 adapter with the same two methods replaces it when a bucket exists. */
export function storage(env = process.env) {
  if (provider('storage', env) !== 'local') throw new HttpError(503, 'File storage is not configured', 'not_configured');
  const dir = resolve(env.STORAGE_DIR ?? '.storage');
  const path = (key) => {
    if (!/^[\w-]+$/.test(key)) throw new Error('bad storage key');
    return join(dir, key);
  };
  return {
    async put(key, bytes) { await mkdir(dir, { recursive: true }); await writeFile(path(key), bytes, { flag: 'wx' }); },
    get: (key) => readFile(path(key)),
  };
}

// ---------------------------------------------------------------- orders (TikTok Shop)
/**
 * Sandbox order report for a session: deterministic from the booking id, priced from the campaign's products, with a few
 * cancellations, refunds and unattributed orders so every settlement rule is exercised. Demo data, never real sales.
 */
export function sandboxOrders(bookingId, startsAt, prices) {
  let seed = [...bookingId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const count = 20 + Math.floor(rand() * 40);
  return Array.from({ length: count }, (_, i) => {
    const r = rand();
    return {
      order_id: `SBX-${bookingId.slice(0, 8)}-${String(i + 1).padStart(3, '0')}`,
      placed_at: new Date(new Date(startsAt).getTime() + Math.floor(rand() * 3 * 3.6e6)).toISOString(),
      amount_cents: String(prices[Math.floor(rand() * prices.length)] * (1 + Math.floor(rand() * 2))),
      status: r < 0.05 ? 'cancelled' : r < 0.1 ? 'refunded' : 'completed',
      attributed: rand() < 0.93 ? 'true' : 'false',
    };
  });
}
