// Client IP behind the web proxy: with TRUSTED_PROXIES naming the web app's address, each client gets its own
// rate-limit bucket; without it, X-Forwarded-For is ignored, so a forged header can't buy a fresh bucket.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';

const pool = { query: async () => ({ rows: [] }) }; // no database needed for this route

async function hits(trustProxy, ips) {
  const app = buildApp({ pool, trustProxy, rateLimitScale: 1 / 600 }); // global limit: 1 request per minute per client
  try {
    const out = [];
    for (const ip of ips) out.push((await app.inject({ method: 'GET', url: '/v1/me', headers: { 'x-forwarded-for': ip } })).statusCode);
    return out;
  } finally {
    await app.close();
  }
}

test('trusted web proxy (loopback): clients are rate-limited separately by their real address', async () => {
  assert.deepEqual(await hits('loopback', ['203.0.113.7', '203.0.113.7', '198.51.100.9']), [401, 429, 401]);
});

test('no trusted proxies: X-Forwarded-For is ignored', async () => {
  assert.deepEqual(await hits(false, ['203.0.113.7', '198.51.100.9']), [401, 429]);
});

test('a hop count is refused by Fastify (fails closed), so it must never be the configuration', async () => {
  assert.deepEqual(await hits(1, ['203.0.113.7', '198.51.100.9']), [401, 429]);
});
