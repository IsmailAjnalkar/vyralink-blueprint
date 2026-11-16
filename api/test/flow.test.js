// End-to-end: the blueprint's GlowSkin campaign through every MVP step, against a fresh database.
// Needs the dev Postgres running (npm run db:start).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { COURSES } from '../src/academy.js';
import { migrate } from '../src/db.js';

const BASE = process.env.TEST_DB_BASE ?? 'postgres://postgres:postgres@127.0.0.1:5441';
let app, pool;
const T = {}; // tokens
const id = {};

async function call(method, url, { as, org, body } = {}) {
  const res = await app.inject({ method, url, headers: { ...(as ? { authorization: `Bearer ${T[as]}` } : {}), ...(org ? { 'x-org-id': org } : {}) }, payload: body });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}
async function ok(method, url, opts, expect = [200, 201]) {
  const r = await call(method, url, opts);
  assert.ok([].concat(expect).includes(r.status), `${method} ${url} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

before(async () => {
  const admin = new pg.Client({ connectionString: `${BASE}/postgres` });
  await admin.connect();
  await admin.query('DROP DATABASE IF EXISTS vyralink_test WITH (FORCE)');
  await admin.query('CREATE DATABASE vyralink_test');
  await admin.end();
  pool = new pg.Pool({ connectionString: `${BASE}/vyralink_test` });
  await migrate(pool);
  app = buildApp({ pool });
  await app.ready();
});
after(async () => {
  await app?.close();
  await pool?.end();
});

const signup = async (key, kind, name, extra = {}) => {
  const r = await ok('POST', '/auth/signup', { body: { email: `${key}@example.com`, password: 'correct-horse-battery', name, kind, ...extra } });
  T[key] = r.token;
  return r;
};

test('GlowSkin campaign: onboarding → LIVE → reconciliation → payout', async () => {
  // ---- accounts
  const maya = await signup('maya', 'brand', 'Maya Chen', { companyName: 'GlowSkin Beauty' });
  id.brand = maya.orgId;
  await signup('leo', 'staff', 'Leo Park');
  const sarah = await signup('sarah', 'seller', 'Sarah Johnson');
  id.sarah = sarah.user.id;
  for (const [k, n] of [['rosa', 'Rosa Diaz'], ['jordan', 'Jordan P.'], ['sam', 'Sam K.'], ['alex', 'Alex M.'], ['bea', 'Bea Second']]) await signup(k, 'staff', n);
  const taylor = await signup('taylor', 'staff', 'Taylor Reed');
  await pool.query('UPDATE users SET is_super_admin = true WHERE id = $1', [taylor.user.id]);
  const brand = { as: 'maya', org: id.brand };

  // wrong password and unknown email answer the same way
  assert.equal((await call('POST', '/auth/login', { body: { email: 'maya@example.com', password: 'nope-nope-nope' } })).status, 401);
  assert.equal((await call('POST', '/auth/login', { body: { email: 'ghost@example.com', password: 'nope-nope-nope' } })).status, 401);

  // ---- Creator Hub operator, location, booths, staff
  const ops = await ok('POST', '/admin/orgs', { as: 'taylor', body: { kind: 'operator', name: 'Creator Hub' } });
  id.ops = ops.id;
  for (const [email, role] of [['rosa', 'location_manager'], ['jordan', 'producer'], ['sam', 'inventory'], ['alex', 'finance_admin'], ['bea', 'finance_admin']]) await ok('POST', `/admin/orgs/${ops.id}/members`, { as: 'taylor', body: { email: `${email}@example.com`, role } });
  const rosa = { as: 'rosa', org: id.ops };
  const loc = await ok('POST', '/locations', { ...rosa, body: { name: 'Creator Hub Virginia', address: 'Richmond, VA', status: 'open' } });
  id.loc = loc.id;
  id.booth = (await ok('POST', `/locations/${loc.id}/booths`, { ...rosa, body: { name: 'Beauty Booth 01', type: 'beauty', categories: ['beauty'] } })).id;

  // ---- brand verification (BF01): publishing is blocked until verified
  await ok('POST', '/orgs/current/members', { ...brand, body: { email: 'leo@example.com', role: 'brand_marketing_manager' } });
  const ver = await ok('POST', '/orgs/current/verification', { ...brand, body: { details: { legalName: 'GlowSkin Beauty LLC' }, documents: [{ type: 'formation', fileName: 'formation.pdf' }] } });
  await ok('POST', `/admin/verifications/${ver.id}/decision`, { as: 'taylor', body: { decision: 'approve' } });

  // ---- product (BF02)
  const product = await ok('POST', '/products', { ...brand, body: { name: 'Vitamin C Face Serum', sku: 'GS-VC-30', priceCents: 4000, category: 'skincare', inventory: 10000, samplesAvailable: 4, sellingPoints: ['Contains 15% vitamin C'], restrictedClaims: ['Cures acne'] } });
  id.product = product.id;
  const draftCampaign = await call('POST', '/campaigns', { ...brand, body: { name: 'Too early', type: 'live_shopping', productIds: [product.id], startsAt: new Date(Date.now() + 864e5).toISOString(), endsAt: new Date(Date.now() + 864e5 + 3 * 3.6e6).toISOString(), baseRateCents: 3000, productionFeeCents: 75000, budgetCapCents: 200000 } });
  assert.equal(draftCampaign.body.code, 'product_not_approved');
  await ok('POST', `/products/${product.id}/submit`, brand);
  await ok('POST', `/admin/products/${product.id}/decision`, { as: 'taylor', body: { decision: 'approve' } });

  // ---- campaign (BF03, BF04): manager over threshold needs owner approval
  const start = new Date(Date.now() + 50 * 60000); // arrival (−45 min) is 5 minutes from now, so check-in is open
  const end = new Date(start.getTime() + 3 * 3.6e6);
  const terms = { type: 'live_shopping', productIds: [product.id], startsAt: start.toISOString(), endsAt: end.toISOString(), baseRateCents: 3000, commissionBps: 500, bonusCents: 10000, bonusGmvThresholdCents: 500000, productionFeeCents: 75000, performanceFeeBps: 700, budgetCapCents: 200000, targetGmvCents: 1000000, requiredCourses: ['beauty_claims'] };
  const camp = await ok('POST', '/campaigns', { as: 'leo', org: id.brand, body: { name: 'Vitamin C LIVE — Saturday', ...terms } });
  id.campaign = camp.id;
  assert.equal((await ok('POST', `/campaigns/${camp.id}/publish`, { as: 'leo', org: id.brand })).status, 'pending_approval');
  assert.equal((await call('POST', `/campaigns/${camp.id}/approve`, { as: 'leo', org: id.brand })).status, 403);
  assert.equal((await ok('POST', `/campaigns/${camp.id}/approve`, brand)).status, 'published');

  // ---- booth hold and double-booking prevention (BF08)
  const hold = await ok('POST', `/campaigns/${camp.id}/hold`, { ...brand, body: { boothId: id.booth } });
  id.booking = hold.id;
  const other = await ok('POST', '/campaigns', { ...brand, body: { name: 'Spring serum LIVE', ...terms, startsAt: new Date(start.getTime() + 3.6e6).toISOString(), endsAt: new Date(end.getTime() + 3.6e6).toISOString() } });
  const clash = await call('POST', `/campaigns/${other.id}/hold`, { ...brand, body: { boothId: id.booth } });
  assert.equal(clash.status, 409);
  assert.equal(clash.body.code, 'overlap');
  assert.match(clash.body.error, /Beauty Booth 01 is already booked/);

  // ---- seller onboarding, invitation, counter, contract (BF05–BF07)
  await ok('PUT', '/seller/profile', { as: 'sarah', body: { displayName: 'Sarah Johnson', categories: ['beauty', 'skincare'], languages: ['English', 'Spanish'], rateCents: 3000, commissionBps: 500 } });
  const inv = await ok('POST', `/campaigns/${camp.id}/invitations`, { ...brand, body: { sellerId: id.sarah } });
  await ok('POST', `/invitations/${inv.id}/view`, { as: 'sarah' });
  assert.equal((await call('POST', `/invitations/${inv.id}/accept`, { as: 'sarah' })).body.code, 'seller_not_verified');
  await ok('POST', `/admin/sellers/${id.sarah}/provider-status`, { as: 'taylor', body: { identityVerified: true, payoutVerified: true, taxFormOnFile: true } });
  assert.equal((await call('POST', `/invitations/${inv.id}/accept`, { as: 'sarah' })).body.code, 'training_missing');
  // The server grades: a self-reported score is rejected, wrong answers fail, and a failed check can't be retaken for 24 h.
  assert.equal((await call('POST', '/academy/beauty_claims/assessment', { as: 'sarah', body: { score: 100 } })).status, 400);
  const quiz = await ok('GET', '/academy/beauty_claims/assessment', { as: 'sarah' });
  assert.ok(quiz.questions.every((q) => q.answer === undefined)); // answer key never sent
  const key = (c) => COURSES[c].questions.map((q) => q.answer);
  const wrong = (c) => COURSES[c].questions.map((q) => (q.answer + 1) % q.options.length);
  assert.equal((await ok('POST', '/academy/tiktok_shop_tools/assessment', { as: 'sarah', body: { answers: wrong('tiktok_shop_tools') } })).passed, false);
  assert.equal((await call('POST', '/academy/tiktok_shop_tools/assessment', { as: 'sarah', body: { answers: key('tiktok_shop_tools') } })).body.code, 'retake_wait');
  assert.equal((await ok('POST', '/academy/beauty_claims/assessment', { as: 'sarah', body: { answers: key('beauty_claims') } })).passed, true);
  await ok('POST', `/invitations/${inv.id}/counter`, { as: 'sarah', body: { baseRateCents: 3500, message: 'Saturday evening' } });
  await ok('POST', `/invitations/${inv.id}/respond`, { ...brand, body: { accept: false, baseRateCents: 3000 } });
  const accepted = await ok('POST', `/invitations/${inv.id}/accept`, { as: 'sarah' });
  id.contract = accepted.contract.id;
  assert.equal(accepted.contract.terms.baseRateCents, 3000);
  await ok('POST', `/contracts/${id.contract}/sign`, { ...brand, body: { typedName: 'Maya Chen' } });
  const signed = await ok('POST', `/contracts/${id.contract}/sign`, { as: 'sarah', body: { typedName: 'Sarah Johnson' } });
  assert.deepEqual(signed, { brandSigned: true, sellerSigned: true });
  // A signed booking can't be overwritten by inviting someone else.
  const priya = await signup('priya', 'seller', 'Priya Nair');
  assert.equal((await call('POST', `/campaigns/${camp.id}/invitations`, { ...brand, body: { sellerId: priya.user.id } })).body.code, 'already_booked');

  // ---- studio confirmation needs a producer (BF08, BF10)
  assert.equal((await call('POST', `/bookings/${id.booking}/confirm`, rosa)).body.code, 'no_producer');
  const jordanId = (await ok('GET', '/orgs/current/members', rosa)).find((m) => m.name === 'Jordan P.').id;
  await ok('POST', `/bookings/${id.booking}/assign-producer`, { ...rosa, body: { producerId: jordanId } });
  await ok('POST', `/bookings/${id.booking}/confirm`, rosa);
  assert.equal((await ok('GET', `/campaigns/${camp.id}`, brand)).status, 'scheduled');

  // ---- samples (BF09)
  const ship = await ok('POST', `/bookings/${id.booking}/shipments`, { ...brand, body: { productId: product.id, expectedQty: 4, tracking: 'TRACK-1' } });
  assert.equal((await ok('POST', `/shipments/${ship.id}/receive`, { as: 'sam', org: id.ops, body: { receivedQty: 4, condition: 'good', shelf: 'S2' } })).status, 'received');

  // ---- check-in, readiness, LIVE (BF11–BF13)
  const jordan = { as: 'jordan', org: id.ops };
  const { checkin_code: code } = await ok('GET', `/bookings/${id.booking}`, { as: 'sarah' });
  assert.equal((await call('POST', `/bookings/${id.booking}/check-in`, { ...jordan, body: { code: 'VL-0000' } })).body.code, 'wrong_code');
  assert.equal((await ok('POST', `/bookings/${id.booking}/check-in`, { ...jordan, body: { code } })).status, 'checked_in');
  assert.equal((await call('POST', `/bookings/${id.booking}/go`, jordan)).body.code, 'not_ready');
  await ok('POST', `/bookings/${id.booking}/briefing/acknowledge`, { as: 'sarah' });
  for (const item of ['tiktok_logged_in', 'showcase_ready', 'camera_audio', 'network', 'samples_at_booth', 'compliance']) await ok('POST', `/bookings/${id.booking}/readiness/${item}`, { ...jordan, body: { result: 'pass' } });
  await ok('POST', `/bookings/${id.booking}/go`, { ...jordan, body: {} });
  await ok('POST', `/bookings/${id.booking}/start`, jordan);
  await ok('POST', `/bookings/${id.booking}/metrics`, { ...jordan, body: { orders: 64, gmvCents: 256000, asOf: new Date().toISOString() } });
  const cc = await ok('GET', `/locations/${id.loc}/control-center`, rosa);
  assert.equal(cc.sessions[0].orders.source, 'Manual');
  assert.equal(cc.sessions[0].viewers.source, 'Unavailable');

  // ---- closeout: base pay locks from the studio log, production fee invoiced (BF13, BF17)
  const { rows: [{ actual_start }] } = await pool.query('SELECT actual_start FROM bookings WHERE id = $1', [id.booking]);
  const close = await ok('POST', `/bookings/${id.booking}/closeout`, { ...jordan, body: { actualEnd: new Date(actual_start.getTime() + 3 * 3.6e6).toISOString() } });
  assert.equal(close.basePayCents, 9000);

  // ---- results import: 150 × $40, then 4 refunds (BF15, BF16)
  const csv = ['order_id,placed_at,amount_cents,status', ...Array.from({ length: 150 }, (_, i) => `O${i + 1},${new Date().toISOString()},4000,completed`)].join('\n');
  const imp = await ok('POST', `/bookings/${id.booking}/results`, { as: 'alex', org: id.ops, body: { csv } });
  assert.equal(imp.settlement.commissionCents, 30000);
  await ok('POST', `/bookings/${id.booking}/refunds`, { as: 'alex', org: id.ops, body: { csv: 'order_id,refund_cents\nO1,4000\nO2,4000\nO3,4000\nO4,4000' } });
  const st = await ok('GET', `/bookings/${id.booking}/settlement`, brand);
  assert.deepEqual([st.gmvCents, st.eligibleCents, st.commissionCents, st.bonusCents, st.performanceFeeCents], [600000, 584000, 29200, 10000, 40880]);
  const sellerView = await ok('GET', `/bookings/${id.booking}/settlement`, { as: 'sarah' });
  assert.equal(sellerView.performanceFeeCents, undefined); // sellers don't see brand fees…
  assert.equal(sellerView.terms.performance_fee_bps, undefined); // …in amounts or in terms
  assert.equal(sellerView.terms.production_fee_cents, undefined);
  const detail = await ok('GET', `/campaigns/${camp.id}`, brand);
  assert.equal(detail.bookings[0].checkin_code, undefined); // the check-in code is for the seller and studio only

  // ---- lock waits for the returns window (BF16)
  assert.equal((await call('POST', `/bookings/${id.booking}/lock`, { as: 'alex', org: id.ops })).body.code, 'returns_window_open');
  await pool.query(`UPDATE bookings SET returns_window_ends_at = now() - interval '1 minute' WHERE id = $1`, [id.booking]);
  await ok('POST', `/bookings/${id.booking}/lock`, { as: 'alex', org: id.ops });
  const invoices = await ok('GET', '/invoices', brand);
  assert.equal(invoices.find((i) => i.kind === 'production').amount_cents, 75000);
  const perf = invoices.find((i) => i.kind === 'performance');
  assert.deepEqual([perf.amount_cents, perf.status], [40880, 'issued']);
  assert.equal((await ok('GET', `/campaigns/${camp.id}`, brand)).status, 'completed');

  // ---- refund after lock: adjustment + credit note, never an edit
  const late = await ok('POST', `/bookings/${id.booking}/refunds`, { as: 'alex', org: id.ops, body: { csv: 'order_id,refund_cents\nO5,4000' } });
  assert.deepEqual(late.adjustments, [{ kind: 'commission', deltaCents: -200 }, { kind: 'performance_fee', deltaCents: -280 }]);

  // ---- brand report: GMV is sales, cost is fees
  const report = await ok('GET', `/campaigns/${camp.id}/report`, brand);
  assert.equal(report.results.gmvPerHourCents, 200000);
  assert.equal(report.final, true);

  // ---- disputes: seller claim (no hold), brand claim (holds only the disputed part, at most what's unpaid)
  const d1 = await ok('POST', '/disputes', { as: 'sarah', body: { type: 'attribution', bookingId: id.booking, amountCents: 400, claim: 'I counted 152 orders' } });
  await ok('POST', `/disputes/${d1.id}/decide`, { as: 'taylor', body: { decision: 'Orders after 10 PM were not attributed to the LIVE', outcomeCents: 0 } });
  const d2 = await ok('POST', '/disputes', { ...brand, body: { type: 'deliverables', bookingId: id.booking, amountCents: 5000, claim: 'Demo cadence missed' } });
  assert.equal(d2.heldCents, 5000);
  assert.equal((await call('POST', '/disputes', { ...brand, body: { type: 'deliverables', bookingId: id.booking, amountCents: 5000, claim: 'Again' } })).body.code, 'dispute_open');
  assert.equal((await ok('GET', `/campaigns/${camp.id}`, brand)).status, 'disputed');
  assert.equal((await ok('GET', '/seller/earnings', { as: 'sarah' })).onHoldCents, 5000);
  assert.equal((await call('POST', `/disputes/${d2.id}/decide`, { as: 'taylor', body: { decision: 'Too much', outcomeCents: 9000 } })).status, 400); // can't take more than was held
  await ok('POST', `/disputes/${d2.id}/decide`, { as: 'taylor', body: { decision: 'Partly upheld', outcomeCents: 2000 } });
  assert.equal((await ok('GET', `/campaigns/${camp.id}`, brand)).status, 'completed');

  // ---- payout run, one approver under the threshold, provider success (BF18)
  const run = await ok('POST', '/payout-runs', { as: 'alex', org: id.ops });
  assert.equal(run.payouts[0].amount_cents, 9000 + 29200 + 10000 - 200 - 2000); // held −5000, released +5000, outcome −2000
  assert.equal((await ok('POST', '/payout-runs', { as: 'alex', org: id.ops })).run, null); // nothing left to pay twice
  await ok('POST', `/payout-runs/${run.run.id}/approve`, { as: 'alex', org: id.ops });
  const exec = await ok('POST', `/payout-runs/${run.run.id}/execute`, { as: 'alex', org: id.ops, body: {} });
  assert.deepEqual([exec.paid, exec.failed], [1, 0]);
  assert.equal((await ok('GET', '/seller/earnings', { as: 'sarah' })).paidCents, 46000);

  // ---- a paid-out session leaves nothing to hold
  await pool.query(`UPDATE disputes SET status = 'decided' WHERE booking_id = $1`, [id.booking]);
  assert.equal((await ok('POST', '/disputes', { ...brand, body: { type: 'deliverables', bookingId: id.booking, amountCents: 5000, claim: 'Late claim' } })).heldCents, 0);

  // ---- large adjustments need a second person, approving with their own login
  const adj = await ok('POST', '/ledger/adjustments', { as: 'alex', org: id.ops, body: { bookingId: id.booking, amountCents: 600000, reason: 'Test: large goodwill' } });
  assert.equal(adj.status, 'pending_approval');
  assert.equal((await call('POST', `/ledger/adjustments/${adj.id}/approve`, { as: 'alex', org: id.ops })).body.code, 'same_approver');
  assert.equal((await ok('POST', `/ledger/adjustments/${adj.id}/approve`, { as: 'bea', org: id.ops })).status, 'locked');

  // ---- big payout runs need two different approvers
  const big = await ok('POST', '/payout-runs', { as: 'alex', org: id.ops });
  assert.equal((await ok('POST', `/payout-runs/${big.run.id}/approve`, { as: 'alex', org: id.ops })).status, 'draft');
  assert.equal((await call('POST', `/payout-runs/${big.run.id}/approve`, { as: 'alex', org: id.ops })).body.code, 'same_approver');
  assert.equal((await ok('POST', `/payout-runs/${big.run.id}/approve`, { as: 'bea', org: id.ops })).status, 'approved');
  const failed = await ok('POST', `/payout-runs/${big.run.id}/execute`, { as: 'alex', org: id.ops, body: { failSellerIds: [id.sarah], failureReason: 'Account closed' } });
  assert.equal(failed.failed, 1);
  const payout = (await ok('GET', '/seller/payouts', { as: 'sarah' })).find((p) => p.status === 'failed');
  await ok('POST', `/payouts/${payout.id}/retry`, { as: 'alex', org: id.ops });

  // ---- audit trail and cancellation quote
  assert.ok((await ok('GET', '/admin/audit?action=results.', { as: 'taylor' })).length >= 2);
  const quote = await ok('POST', `/campaigns/${other.id}/cancel`, { ...brand, body: { confirm: false } });
  assert.equal(quote.quote.feeCents, 0); // no confirmed booking → no fee
});

test('permissions: unauthenticated, wrong org, wrong role', async () => {
  assert.equal((await call('GET', '/campaigns')).status, 401);
  assert.equal((await call('GET', '/me')).status, 401);
  assert.equal((await call('GET', '/invoices', { as: 'leo', org: id.brand })).status, 403); // marketing managers can't see billing
  assert.equal((await call('GET', `/campaigns/${id.campaign}`, { as: 'rosa', org: id.ops })).status, 403);
  assert.equal((await call('GET', '/admin/orgs', { as: 'maya' })).status, 403);
  assert.equal((await call('DELETE', `/orgs/current/members/${(await ok('GET', '/me', { as: 'maya' })).user.id}`, { as: 'maya', org: id.brand })).body.code, 'last_owner');
  // database detail never leaks in errors
  const dup = await call('POST', '/auth/signup', { body: { email: 'maya@example.com', password: 'correct-horse-battery', name: 'Again', kind: 'seller' } });
  assert.deepEqual([dup.status, dup.body.detail], [409, undefined]);
});

test('suspended organizations are read-only', async () => {
  const shady = await signup('shady', 'brand', 'Shady Owner', { companyName: 'Shady Co' });
  await ok('POST', `/admin/orgs/${shady.orgId}/suspend`, { as: 'taylor', body: { reason: 'Fraud review' } });
  const asShady = { as: 'shady', org: shady.orgId };
  assert.equal((await call('POST', '/products', { ...asShady, body: { name: 'X', sku: 'X-1', priceCents: 100, category: 'misc' } })).status, 403);
  assert.equal((await call('POST', '/orgs/current/verification', { ...asShady, body: { details: {}, documents: [{ type: 'id', fileName: 'id.pdf' }] } })).status, 403);
  assert.equal((await call('GET', '/orgs/current', asShady)).status, 200);
});
