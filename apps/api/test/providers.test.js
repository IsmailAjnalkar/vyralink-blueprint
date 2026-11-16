// Provider switches and the sandbox order generator (no database).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertProductionReady, integrations, sandboxOrders } from '../src/providers.js';

test('defaults are the sandbox/dev providers, each labelled', () => {
  const byName = Object.fromEntries(integrations({}).map((i) => [i.name, i]));
  assert.deepEqual(Object.fromEntries(Object.entries(byName).map(([k, v]) => [k, `${v.provider}:${v.status}`])), {
    payments: 'sandbox:sandbox', email: 'dev:dev', storage: 'local:dev', orders: 'csv:manual',
  });
  assert.ok(Object.values(byName).every((i) => i.detail.length > 20));
  assert.throws(() => integrations({ PAYMENTS_PROVIDER: 'paypal' }), /PAYMENTS_PROVIDER must be one of/);
});

test('production refuses to start on simulated or unconnected providers', () => {
  assert.doesNotThrow(() => assertProductionReady({ NODE_ENV: 'development' }));
  assert.throws(() => assertProductionReady({ NODE_ENV: 'production' }), /payments=sandbox \(sandbox\).*email=dev.*storage=local/);
  assert.throws(() => assertProductionReady({ NODE_ENV: 'production', PAYMENTS_PROVIDER: 'stripe', EMAIL_PROVIDER: 'smtp', STORAGE_PROVIDER: 's3' }), /payments=stripe \(blocked\)/);
  assert.throws(() => assertProductionReady({ NODE_ENV: 'production', ORDERS_PROVIDER: 'sandbox' }), /orders=sandbox/);
});

test('sandbox orders are deterministic, priced from the products, and exercise every rule', () => {
  const id = '6f1c2a9e-0000-4000-8000-000000000001';
  const a = sandboxOrders(id, '2026-11-16T19:00:00Z', [4000, 2500]);
  assert.deepEqual(a, sandboxOrders(id, '2026-11-16T19:00:00Z', [4000, 2500]));
  assert.ok(a.length >= 20 && a.length < 60);
  assert.equal(new Set(a.map((o) => o.order_id)).size, a.length);
  assert.ok(a.every((o) => o.order_id.startsWith('SBX-')));
  assert.ok(a.every((o) => [4000, 8000, 2500, 5000].includes(Number(o.amount_cents))));
  assert.ok(a.every((o) => ['completed', 'cancelled', 'refunded'].includes(o.status)));
  const t0 = Date.parse('2026-11-16T19:00:00Z');
  assert.ok(a.every((o) => Date.parse(o.placed_at) >= t0 && Date.parse(o.placed_at) < t0 + 3 * 3.6e6));
  // Across a few sessions the generator produces cancellations, refunds and unattributed orders.
  const many = ['a', 'b', 'c', 'd', 'e'].flatMap((s) => sandboxOrders(`${s}${id.slice(1)}`, '2026-11-16T19:00:00Z', [4000]));
  for (const want of [(o) => o.status === 'cancelled', (o) => o.status === 'refunded', (o) => o.attributed === 'false']) assert.ok(many.some(want));
});
