// Account security: verification, lockout, reset, MFA, sessions, invitations, rate limits, staff roles, OpenAPI.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { base32Decode, totp, verifyTotp } from '../src/crypto.js';
import { migrate } from '../src/db.js';
import { devMailTransport, runDueJobs } from '../src/jobs.js';

const BASE = process.env.TEST_DB_BASE ?? 'postgres://postgres:postgres@127.0.0.1:5441';
const DB = 'vyralink_test_auth';
let app, pool;
const PW = 'correct-horse-battery';

async function call(method, url, { token, org, body, appUnder = app } = {}) {
  const res = await appUnder.inject({ method, url: `/v1${url}`, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(org ? { 'x-org-id': org } : {}) }, payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}
const lastEmail = async (to) => (await pool.query(`SELECT payload FROM jobs WHERE kind = 'email' AND lower(payload->>'to') = lower($1) ORDER BY id DESC LIMIT 1`, [to])).rows[0]?.payload;
const tokenIn = (mail) => mail.text.match(/token=([\w-]+)/)[1];
async function account(email, kind = 'staff', extra = {}) {
  await call('POST', '/auth/signup', { body: { email, password: PW, name: email.split('@')[0], kind, ...extra } });
  return (await call('POST', '/auth/verify-email', { body: { token: tokenIn(await lastEmail(email)) } })).body.token;
}

before(async () => {
  const admin = new pg.Client({ connectionString: `${BASE}/postgres` });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();
  pool = new pg.Pool({ connectionString: `${BASE}/${DB}` });
  await migrate(pool);
  app = buildApp({ pool, rateLimitScale: 1000 });
  await app.ready();
});
after(async () => {
  await app?.close();
  await pool?.end();
});

test('TOTP matches the RFC 6238 test vector', () => {
  const secret = Buffer.from('12345678901234567890');
  assert.equal(totp(secret, 59, 8), '94287082');
  assert.equal(totp(secret, 1111111109, 8), '07081804');
  assert.ok(verifyTotp(secret, totp(secret, 1000), 1000 + 30)); // one step of drift allowed
  assert.ok(!verifyTotp(secret, totp(secret, 1000), 1000 + 120));
  assert.ok(!verifyTotp(secret, 'abc123'));
});

test('email verification gates sign-in; links are single use', async () => {
  await call('POST', '/auth/signup', { body: { email: 'v@example.com', password: PW, name: 'V', kind: 'seller' } });
  assert.equal((await call('POST', '/auth/login', { body: { email: 'v@example.com', password: PW } })).status, 403);
  const link = tokenIn(await lastEmail('v@example.com'));
  assert.equal((await call('POST', '/auth/verify-email', { body: { token: link } })).status, 200);
  assert.equal((await call('POST', '/auth/verify-email', { body: { token: link } })).body.code, 'token_used');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'v@example.com', password: PW } })).status, 200);
  assert.equal((await call('POST', '/auth/verify-email', { body: { token: 'made-up-token-value' } })).status, 404);
});

test('lockout after 5 failed sign-ins, even with the right password', async () => {
  await account('lock@example.com');
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/auth/login', { body: { email: 'lock@example.com', password: 'wrong-password-123' } })).status, 401);
  const r = await call('POST', '/auth/login', { body: { email: 'lock@example.com', password: PW } });
  assert.deepEqual([r.status, r.body.code], [429, 'account_locked']);
});

test('password reset: same answer for unknown emails, signs out every session', async () => {
  const old = await account('reset@example.com');
  const unknown = await call('POST', '/auth/password-reset', { body: { email: 'nobody@example.com' } });
  const known = await call('POST', '/auth/password-reset', { body: { email: 'reset@example.com' } });
  assert.deepEqual([unknown.status, unknown.body], [known.status, known.body]);
  assert.equal((await call('POST', '/auth/password-reset/confirm', { body: { token: tokenIn(await lastEmail('reset@example.com')), password: 'a-brand-new-password' } })).status, 200);
  assert.equal((await call('GET', '/me', { token: old })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'reset@example.com', password: PW } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'reset@example.com', password: 'a-brand-new-password' } })).status, 200);
});

test('MFA: two-step sign-in; the half-signed-in session can do nothing else', async () => {
  const t = await account('mfa@example.com');
  const { secret } = (await call('POST', '/auth/mfa/setup', { token: t })).body;
  assert.equal((await call('POST', '/auth/mfa/enable', { token: t, body: { code: '000000' } })).body.code, 'invalid_code');
  const enrollCode = totp(base32Decode(secret));
  assert.equal((await call('POST', '/auth/mfa/enable', { token: t, body: { code: enrollCode } })).status, 200);
  const step1 = (await call('POST', '/auth/login', { body: { email: 'mfa@example.com', password: PW } })).body;
  assert.equal(step1.mfaRequired, true);
  assert.equal((await call('GET', '/me', { token: step1.token })).status, 401);
  assert.equal((await call('POST', '/auth/mfa/verify', { token: step1.token, body: { code: '123456' } })).status, 401);
  // The code used to enroll can't be replayed; the next 30-second step's code works (one step of drift allowed).
  assert.equal((await call('POST', '/auth/mfa/verify', { token: step1.token, body: { code: enrollCode } })).status, 401);
  const nextStep = totp(base32Decode(secret), (Math.floor(Date.now() / 30000) + 1) * 30);
  const step2 = await call('POST', '/auth/mfa/verify', { token: step1.token, body: { code: nextStep } });
  assert.equal(step2.status, 200);
  const me = (await call('GET', '/me', { token: step2.body.token })).body;
  assert.deepEqual([me.mfa.enabled, me.mfa.passed], [true, true]);
  const { rows: [u] } = await pool.query(`SELECT mfa_secret_enc FROM users WHERE email = 'mfa@example.com'`);
  assert.ok(!u.mfa_secret_enc.includes(secret)); // stored encrypted, not as the shared secret
});

test('MFA brute force: wrong codes lock the account and destroy the half-signed-in session', async () => {
  const t = await account('mfa-brute@example.com');
  const { secret } = (await call('POST', '/auth/mfa/setup', { token: t })).body;
  await call('POST', '/auth/mfa/enable', { token: t, body: { code: totp(base32Decode(secret)) } });
  const pending = (await call('POST', '/auth/login', { body: { email: 'mfa-brute@example.com', password: PW } })).body.token;
  for (let i = 0; i < 5; i++) await call('POST', '/auth/mfa/verify', { token: pending, body: { code: '000000' } });
  assert.equal((await call('POST', '/auth/mfa/verify', { token: pending, body: { code: totp(base32Decode(secret)) } })).body.code, 'unauthenticated');
  assert.equal((await call('POST', '/auth/login', { body: { email: 'mfa-brute@example.com', password: PW } })).body.code, 'account_locked');
});

test('MFA brute force can’t be reset by signing in with the password again', async () => {
  const t = await account('mfa-interleave@example.com');
  const { secret } = (await call('POST', '/auth/mfa/setup', { token: t })).body;
  await call('POST', '/auth/mfa/enable', { token: t, body: { code: totp(base32Decode(secret)) } });
  const login = async () => (await call('POST', '/auth/login', { body: { email: 'mfa-interleave@example.com', password: PW } })).body;
  for (let i = 0; i < 4; i++) await call('POST', '/auth/mfa/verify', { token: (await login()).token, body: { code: '000000' } }); // new password login each time
  await call('POST', '/auth/mfa/verify', { token: (await login()).token, body: { code: '000000' } }); // 5th wrong code overall
  assert.equal((await login()).code, 'account_locked');
});

test('privileged staff without MFA can’t read disputes either', async () => {
  const t = await account('admin-nomfa@example.com');
  await pool.query(`UPDATE users SET is_super_admin = true WHERE email = 'admin-nomfa@example.com'`);
  assert.equal((await call('GET', '/disputes', { token: t })).body.code, 'mfa_enrollment_required');
});

test('sessions: list, revoke one, sign out everywhere', async () => {
  const a = await account('sess@example.com');
  const b = (await call('POST', '/auth/login', { body: { email: 'sess@example.com', password: PW } })).body.token;
  const list = (await call('GET', '/auth/sessions', { token: a })).body;
  assert.equal(list.length, 2);
  const other = list.find((s) => !s.current);
  assert.equal((await call('DELETE', `/auth/sessions/${other.id}`, { token: a })).status, 200);
  assert.equal((await call('GET', '/me', { token: b })).status, 401);
  await call('POST', '/auth/logout-all', { token: a });
  assert.equal((await call('GET', '/me', { token: a })).status, 401);
});

test('invitations: only the invited email can accept; managers only', async () => {
  const owner = await account('owner@example.com', 'brand', { companyName: 'Acme' });
  const orgId = (await call('GET', '/me', { token: owner })).body.memberships[0].org_id;
  const intruder = await account('intruder@example.com');
  const invitee = await account('invitee@example.com');
  assert.equal((await call('POST', '/orgs/current/invitations', { token: owner, org: orgId, body: { email: 'invitee@example.com', role: 'brand_finance' } })).status, 201);
  const link = tokenIn(await lastEmail('invitee@example.com'));
  assert.equal((await call('POST', '/invitations/accept', { token: intruder, body: { token: link } })).status, 403);
  assert.equal((await call('POST', '/invitations/accept', { token: invitee, body: { token: link } })).body.role, 'brand_finance');
  // Brand Finance sees billing but can't invite or create campaigns.
  assert.equal((await call('GET', '/invoices', { token: invitee, org: orgId })).status, 200);
  assert.equal((await call('GET', '/campaigns', { token: invitee, org: orgId })).status, 403);
  assert.equal((await call('POST', '/orgs/current/invitations', { token: invitee, org: orgId, body: { email: 'x@example.com', role: 'brand_owner' } })).status, 403);
  // An invitation can't change an existing member's role.
  await call('POST', '/orgs/current/invitations', { token: owner, org: orgId, body: { email: 'invitee@example.com', role: 'brand_owner' } });
  assert.equal((await call('POST', '/invitations/accept', { token: invitee, body: { token: tokenIn(await lastEmail('invitee@example.com')) } })).body.code, 'already_member');
  // Revoked invitations stop working.
  await call('POST', '/orgs/current/invitations', { token: owner, org: orgId, body: { email: 'late@example.com', role: 'brand_marketing_manager' } });
  const lateLink = tokenIn(await lastEmail('late@example.com'));
  assert.equal((await call('POST', '/orgs/current/invitations/revoke', { token: owner, org: orgId, body: { email: 'late@example.com' } })).body.revoked, 1);
  const late = await account('late@example.com');
  assert.equal((await call('POST', '/invitations/accept', { token: late, body: { token: lateLink } })).body.code, 'token_used');
});

test('an invitation dies when its sender is no longer a manager', async () => {
  const owner = await account('owner2@example.com', 'brand', { companyName: 'Beta' });
  const orgId = (await call('GET', '/me', { token: owner })).body.memberships[0].org_id;
  const coOwner = await account('co@example.com');
  await call('POST', '/orgs/current/invitations', { token: owner, org: orgId, body: { email: 'co@example.com', role: 'brand_owner' } });
  await call('POST', '/invitations/accept', { token: coOwner, body: { token: tokenIn(await lastEmail('co@example.com')) } });
  await call('POST', '/orgs/current/invitations', { token: coOwner, org: orgId, body: { email: 'friend@example.com', role: 'brand_owner' } });
  const link = tokenIn(await lastEmail('friend@example.com'));
  const coId = (await call('GET', '/me', { token: coOwner })).body.user.id;
  await call('PATCH', `/orgs/current/members/${coId}`, { token: owner, org: orgId, body: { role: 'brand_marketing_manager' } }); // demoted
  const friend = await account('friend@example.com');
  assert.equal((await call('POST', '/invitations/accept', { token: friend, body: { token: link } })).body.code, 'invitation_revoked');
});

test('support admins can read the admin console but not change it', async () => {
  const t = await account('support@example.com');
  await pool.query(`UPDATE users SET is_support_admin = true WHERE email = 'support@example.com'`);
  const { secret } = (await call('POST', '/auth/mfa/setup', { token: t })).body;
  await call('POST', '/auth/mfa/enable', { token: t, body: { code: totp(base32Decode(secret)) } });
  assert.equal((await call('GET', '/admin/orgs', { token: t })).status, 200);
  assert.equal((await call('GET', '/admin/audit', { token: t })).status, 200);
  assert.equal((await call('POST', '/admin/orgs', { token: t, body: { kind: 'operator', name: 'Nope' } })).status, 403);
});

test('numeric settings only take whole numbers (text would break SQL casts and comparisons)', async () => {
  const t = await account('super@example.com');
  await pool.query(`UPDATE users SET is_super_admin = true WHERE email = 'super@example.com'`);
  const { secret } = (await call('POST', '/auth/mfa/setup', { token: t })).body;
  await call('POST', '/auth/mfa/enable', { token: t, body: { code: totp(base32Decode(secret)) } });
  for (const value of ['15', -1, 1.5, null]) assert.equal((await call('PUT', '/admin/settings/invoice_due_days', { token: t, body: { value } })).body.code, 'invalid_setting', String(value));
  assert.equal((await call('PUT', '/admin/settings/invoice_due_days', { token: t, body: { value: 15 } })).status, 200);
  assert.equal((await call('PUT', '/admin/settings/no_such_setting', { token: t, body: { value: 1 } })).status, 404);

  // Account lock: not yourself; a malformed id is a 400, not a server error; locking signs the person out.
  const meId = (await call('GET', '/me', { token: t })).body.user.id;
  assert.equal((await call('POST', `/admin/users/${meId}/lock`, { token: t, body: { locked: true } })).body.code, 'self_lock');
  assert.equal((await call('POST', '/admin/users/not-a-uuid/lock', { token: t, body: { locked: true } })).status, 400);
  const other = await account('lockme@example.com');
  const otherId = (await call('GET', '/me', { token: other })).body.user.id;
  assert.equal((await call('POST', `/admin/users/${otherId}/lock`, { token: t, body: { locked: true } })).status, 200);
  assert.equal((await call('GET', '/me', { token: other })).status, 401);
  const log = (await call('GET', '/admin/audit?action=user.locked', { token: t })).body;
  assert.equal(log[0].actor_email, 'super@example.com');
});

test('rate limits apply to sign-in attempts', async () => {
  const strict = buildApp({ pool, rateLimitScale: 1 });
  await strict.ready();
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await call('POST', '/auth/login', { appUnder: strict, body: { email: 'rl@example.com', password: 'whatever-password' } })).status);
  assert.deepEqual([codes[0], codes[10]], [401, 429]);
  await strict.close();
});

test('worker delivers queued email and scrubs the link from the queue', async () => {
  const dir = new URL('../.dev-mail-test/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  await call('POST', '/auth/password-reset', { body: { email: 'reset@example.com' } });
  await runDueJobs(pool, { email: devMailTransport(dir) }, 100);
  const { rows } = await pool.query(`SELECT payload FROM jobs WHERE kind = 'email' AND status = 'done' AND payload->>'to' = 'reset@example.com'`);
  assert.ok(rows.length > 0 && rows.every((r) => r.payload.text === undefined));
  const { default: fs } = await import('node:fs');
  assert.ok(fs.readdirSync(dir).length > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('OpenAPI document lists the versioned routes', async () => {
  const spec = (await call('GET', '/openapi.json')).body;
  assert.equal(spec.openapi.startsWith('3'), true);
  for (const p of ['/v1/auth/login', '/v1/campaigns', '/v1/bookings/{id}/check-in', '/v1/payout-runs']) assert.ok(spec.paths[p], `missing ${p}`);
});
