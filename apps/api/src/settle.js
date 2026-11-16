// Turns a session's imported orders + agreed terms into ledger lines and invoices (blueprint F05, C21, BF16, BF17).
import { HttpError, one } from './http.js';
import { dollars, settle } from './money.js';

export async function loadSettlement(db, bookingId) {
  const b = await one(db, `SELECT b.*, c.org_id AS brand_org, c.name AS campaign, c.status AS campaign_status, c.commission_bps, c.bonus_cents, c.bonus_gmv_threshold_cents,
      c.production_fee_cents, c.performance_fee_bps, c.base_rate_cents AS campaign_rate,
      (SELECT (terms->>'baseRateCents')::int FROM contracts k WHERE k.campaign_id = c.id AND NOT k.void AND k.seller_id = b.seller_id AND k.seller_signed_at IS NOT NULL AND k.brand_signed_at IS NOT NULL ORDER BY version DESC LIMIT 1) AS agreed_rate
    FROM bookings b JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = $1`, [bookingId], 'Booking not found');
  const { rows: orders } = await db.query('SELECT * FROM session_orders WHERE booking_id = $1', [bookingId]);
  const liveMinutes = b.actual_start && b.actual_end ? Math.max(0, Math.round((b.actual_end - b.actual_start) / 60000) - b.minutes_lost) : 0;
  const terms = { base_rate_cents: b.agreed_rate ?? b.campaign_rate, commission_bps: b.commission_bps, bonus_cents: b.bonus_cents, bonus_gmv_threshold_cents: b.bonus_gmv_threshold_cents, performance_fee_bps: b.performance_fee_bps, production_fee_cents: b.production_fee_cents };
  return { b, terms, liveMinutes, s: settle(orders, terms, liveMinutes) };
}

const commissionBasis = (s, t) => `${t.commission_bps / 100}% × ${dollars(s.eligibleCents)} eligible attributable sales`;
const bonusBasis = (s, t) => (t.bonus_gmv_threshold_cents == null ? 'No bonus in this campaign' : `Eligible GMV ${dollars(s.eligibleCents)} ${s.eligibleCents >= t.bonus_gmv_threshold_cents ? '≥' : '<'} ${dollars(t.bonus_gmv_threshold_cents)}`);
const perfBasis = (s, t) => `${t.performance_fee_bps / 100}% × ${dollars(s.eligibleCents)} eligible attributable GMV`;

/** Before lock: provisional commission/bonus lines and a draft performance-fee invoice track the latest numbers. */
export async function recomputeProvisional(db, bookingId) {
  const { b, terms, s } = await loadSettlement(db, bookingId);
  if (b.results_status === 'locked' || !b.seller_id) return s;
  const upsertLine = (kind, amount, basis) => db.query(
    `INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status) VALUES ($1, $2, $3, $4, $5, 'provisional')
     ON CONFLICT (booking_id, kind) WHERE kind <> 'adjustment' DO UPDATE SET amount_cents = EXCLUDED.amount_cents, basis = EXCLUDED.basis WHERE ledger_entries.status = 'provisional'`,
    [b.seller_id, b.id, kind, basis, amount]);
  await upsertLine('commission', s.commissionCents, commissionBasis(s, terms));
  await upsertLine('bonus', s.bonusCents, bonusBasis(s, terms));
  await db.query(
    `INSERT INTO invoices (number, org_id, campaign_id, booking_id, kind, basis, amount_cents, status) VALUES ('INV-' || nextval('invoice_number_seq'), $1, $2, $3, 'performance', $4, $5, 'draft')
     ON CONFLICT (booking_id, kind) WHERE kind IN ('production', 'performance') DO UPDATE SET amount_cents = EXCLUDED.amount_cents, basis = EXCLUDED.basis WHERE invoices.status = 'draft'`,
    [b.brand_org, b.campaign_id, b.id, perfBasis(s, terms), s.performanceFeeCents]);
  return s;
}

/** Lock: final numbers, one base for both commission and performance fee. */
export async function lockResults(db, bookingId, dueDays) {
  const s = await recomputeProvisional(db, bookingId);
  await db.query(`UPDATE ledger_entries SET status = 'locked' WHERE booking_id = $1 AND kind IN ('commission', 'bonus') AND status = 'provisional'`, [bookingId]);
  await db.query(`UPDATE invoices SET status = 'issued', issued_at = now(), due_at = now() + make_interval(days => $2) WHERE booking_id = $1 AND kind = 'performance' AND status = 'draft'`, [bookingId, dueDays]);
  await db.query(`UPDATE bookings SET results_status = 'locked', locked_at = now() WHERE id = $1`, [bookingId]);
  return s;
}

/** After lock, refunds never edit locked lines: they create adjustments and credit notes for the difference. */
export async function adjustAfterLock(db, bookingId, actorId) {
  const { b, terms, s } = await loadSettlement(db, bookingId);
  const sumLines = async (kind, reason) => (await db.query(
    `SELECT COALESCE(sum(amount_cents), 0)::int AS t FROM ledger_entries WHERE booking_id = $1 AND (kind = $2 OR (kind = 'adjustment' AND reason = $3))`, [bookingId, kind, reason])).rows[0].t;
  const out = [];
  for (const [kind, target] of [['commission', s.commissionCents], ['bonus', s.bonusCents]]) {
    const reason = `refund_after_lock:${kind}`;
    const delta = target - (await sumLines(kind, reason));
    if (delta > 0) throw new HttpError(409, 'After lock, refunds can only lower pay; raising it needs a ledger adjustment with approval', 'increase_after_lock');
    if (delta !== 0) {
      await db.query(`INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status, reason, created_by) VALUES ($1, $2, 'adjustment', $3, $4, 'locked', $5, $6)`,
        [b.seller_id, bookingId, `Refund after lock: ${kind} now ${dollars(target)}`, delta, reason, actorId]);
      out.push({ kind, deltaCents: delta });
    }
  }
  const { rows: [{ t: perfNow }] } = await db.query(`SELECT COALESCE(sum(amount_cents), 0)::int AS t FROM invoices WHERE booking_id = $1 AND (kind = 'performance' OR (kind = 'credit_note' AND basis LIKE 'Refund after lock%'))`, [bookingId]);
  const perfDelta = s.performanceFeeCents - perfNow;
  if (perfDelta > 0) throw new HttpError(409, 'After lock, refunds can only lower fees', 'increase_after_lock');
  if (perfDelta !== 0) {
    await db.query(`INSERT INTO invoices (number, org_id, campaign_id, booking_id, kind, basis, amount_cents, status, issued_at) VALUES ('CR-' || nextval('invoice_number_seq'), $1, $2, $3, 'credit_note', $4, $5, 'issued', now())`,
      [b.brand_org, b.campaign_id, bookingId, `Refund after lock: ${terms.performance_fee_bps / 100}% × eligible now ${dollars(s.eligibleCents)}`, perfDelta]);
    out.push({ kind: 'performance_fee', deltaCents: perfDelta });
  }
  return out;
}
