import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basePay, bonus, cancellationFee, commission, eligibleSales, performanceFee, settle } from '../src/money.js';

// The blueprint's GlowSkin example: 150 orders × $40, 4 refunded.
const orders = Array.from({ length: 150 }, (_, i) => ({ attributed: true, amount_cents: 4000, status: i < 4 ? 'refunded' : 'completed', refund_cents: i < 4 ? 4000 : 0 }));
const terms = { base_rate_cents: 3000, commission_bps: 500, bonus_cents: 10000, bonus_gmv_threshold_cents: 500000, performance_fee_bps: 700, production_fee_cents: 75000 };

test('blueprint example settles to the published numbers', () => {
  const s = settle(orders, terms, 180);
  assert.equal(s.gmvCents, 600000);
  assert.equal(s.eligibleCents, 584000);
  assert.equal(s.basePayCents, 9000);
  assert.equal(s.commissionCents, 29200);
  assert.equal(s.bonusCents, 10000);
  assert.equal(s.performanceFeeCents, 40880);
});

test('without refunds it matches the brief: $90 + $300 + $100, fee $420', () => {
  const clean = orders.map((o) => ({ ...o, status: 'completed', refund_cents: 0 }));
  const s = settle(clean, terms, 180);
  assert.deepEqual([s.basePayCents, s.commissionCents, s.bonusCents, s.performanceFeeCents], [9000, 30000, 10000, 42000]);
});

test('unattributed and cancelled orders never count; partial refunds reduce eligibility', () => {
  const mixed = [{ attributed: true, amount_cents: 4000, status: 'completed' }, { attributed: false, amount_cents: 4000, status: 'completed' }, { attributed: true, amount_cents: 4000, status: 'cancelled' }, { attributed: true, amount_cents: 4000, status: 'completed', refund_cents: 1000 }];
  assert.equal(eligibleSales(mixed), 7000);
});

test('zero sales: base pay still applies, everything else is zero', () => {
  const s = settle([], terms, 180);
  assert.deepEqual([s.basePayCents, s.commissionCents, s.bonusCents, s.performanceFeeCents], [9000, 0, 0, 0]);
});

test('bonus needs the threshold; no threshold means no bonus', () => {
  assert.equal(bonus(499999, 500000, 10000), 0);
  assert.equal(bonus(500000, 500000, 10000), 10000);
  assert.equal(bonus(900000, null, 10000), 0);
});

test('rounding and partial hours', () => {
  assert.equal(basePay(3000, 130), 6500); // 2 h 10 min
  assert.equal(commission(333, 500), 17);
  assert.equal(performanceFee(1, 700), 0);
});

test('cancellation policy: free > 72 h, half 24–72 h, full < 24 h', () => {
  assert.equal(cancellationFee(75000, 100), 0);
  assert.equal(cancellationFee(75000, 52), 37500);
  assert.equal(cancellationFee(75000, 10), 75000);
});
