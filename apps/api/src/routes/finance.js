// Reconciliation, invoices, seller ledger, payout runs, disputes, reports (blueprint F01–F05, B15, B16, C20–C22, A07, A08, BF16–BF19).
// No escrow: brand charges and seller payouts are separate payment-provider flows; GMV is never revenue.
// Every finance record is scoped to the Creator Hub organization that ran the booking.
import { setting, tx } from '../db.js';
import { audit, bad, body, conflict, member, notify, notFound, one, orgUsers, requireMfa, superAdmin, user, BRAND, BRAND_BILLING } from '../http.js';
import { loadSettlement, lockResults } from '../settle.js';
import { assertMove } from '../status.js';

const FIN = ['finance_admin'];
/** SQL: the booking in column `col` was run by the operator org in parameter `p`. */
const OWNS = (col, p) => `EXISTS (SELECT 1 FROM bookings ob JOIN booths obo ON obo.id = ob.booth_id JOIN locations ol ON ol.id = obo.location_id WHERE ob.id = ${col} AND ol.org_id = ${p})`;
const UNPAID = `('provisional', 'locked', 'scheduled')`;

async function finBooking(db, req, id) {
  const m = member(req, FIN);
  const b = await one(db, `SELECT b.*, c.org_id AS brand_org, c.name AS campaign, c.status AS campaign_status, l.org_id AS ops_org FROM bookings b
    JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = $1 FOR UPDATE OF b`, [id], 'Booking not found');
  if (b.ops_org !== m.orgId) throw notFound('Booking not found');
  return b;
}
async function finInvoice(db, req, id) {
  const m = member(req, FIN);
  return one(db, `SELECT i.* FROM invoices i WHERE i.id = $1 AND ${OWNS('i.booking_id', '$2')} FOR UPDATE OF i`, [id, m.orgId], 'Invoice not found');
}

export default async function finance(app) {
  const { pool } = app;

  // ---------------------------------------------------------------- reconciliation lock
  app.post('/bookings/:id/lock', async (req) => {
    return tx(pool, async (db) => {
      const b = await finBooking(db, req, req.params.id);
      if (b.results_status === 'pending') throw conflict('Results aren’t imported yet', 'results_pending');
      if (b.results_status === 'locked') throw conflict('Already locked');
      if (b.returns_window_ends_at > new Date()) throw conflict(`The returns window is open until ${b.returns_window_ends_at.toISOString()}`, 'returns_window_open');
      const s = await lockResults(db, b.id, await setting(db, 'invoice_due_days'));
      if (b.campaign_status === 'in_progress') await db.query(`UPDATE campaigns SET status = 'completed' WHERE id = $1`, [b.campaign_id]);
      await audit(db, req, 'results.locked', 'booking', b.id, s);
      await notify(db, [...(await orgUsers(db, b.brand_org, ['brand_owner'])), b.seller_id], 'results', `Final results for ${b.campaign} are locked. The performance report is ready.`);
      return { status: 'locked', settlement: s };
    });
  });

  // ---------------------------------------------------------------- invoices
  app.get('/invoices', async (req) => {
    const m = member(req, [...BRAND_BILLING, ...FIN]);
    const scope = m.kind === 'brand' ? 'i.org_id = $1' : OWNS('i.booking_id', '$1');
    const { rows } = await pool.query(`SELECT i.*, o.name AS brand FROM invoices i JOIN orgs o ON o.id = i.org_id WHERE ${scope} AND ($2::text IS NULL OR i.status = $2) ORDER BY i.created_at DESC`, [m.orgId, req.query.status ?? null]);
    return rows;
  });

  app.get('/invoices/:id', async (req) => {
    const m = member(req, [...BRAND_BILLING, ...FIN]);
    const scope = m.kind === 'brand' ? 'i.org_id = $2' : OWNS('i.booking_id', '$2');
    return one(pool, `SELECT i.* FROM invoices i WHERE i.id = $1 AND ${scope}`, [req.params.id, m.orgId], 'Invoice not found');
  });

  /** Simulates the payment provider confirming a charge (webhook). Nothing is marked paid without it. */
  app.post('/invoices/:id/paid', async (req) => {
    return tx(pool, async (db) => {
      const i = await finInvoice(db, req, req.params.id);
      assertMove('invoice', i.status, 'paid');
      await db.query(`UPDATE invoices SET status = 'paid', paid_at = now() WHERE id = $1`, [i.id]);
      await audit(db, req, 'invoice.paid', 'invoice', i.id, { amountCents: i.amount_cents });
      return { status: 'paid' };
    });
  });

  app.post('/invoices/:id/payment-failed', { schema: body({ reason: 'string' }) }, async (req) => {
    return tx(pool, async (db) => {
      const i = await finInvoice(db, req, req.params.id);
      await audit(db, req, 'invoice.payment_failed', 'invoice', i.id, req.body);
      await notify(db, await orgUsers(db, i.org_id, BRAND_BILLING), 'billing', `Payment for ${i.number} failed (${req.body.reason}). Update your payment method; we’ll retry.`);
      return { ok: true };
    });
  });

  app.post('/invoices/sweep-overdue', async (req) => {
    const m = member(req, FIN);
    const { rows } = await pool.query(`UPDATE invoices i SET status = 'overdue' WHERE i.status = 'issued' AND i.due_at < now() AND ${OWNS('i.booking_id', '$1')} RETURNING id, number, org_id`, [m.orgId]);
    for (const r of rows) await notify(pool, await orgUsers(pool, r.org_id, BRAND_BILLING), 'billing', `${r.number} is overdue`);
    return { overdue: rows.length };
  });

  app.post('/invoices/:id/credit-note', { schema: body({ amountCents: { type: 'integer', minimum: 1 }, reason: 'string' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      const i = await finInvoice(db, req, req.params.id);
      if (i.kind === 'credit_note' || ['draft', 'void'].includes(i.status)) throw conflict('Credit notes apply to issued or paid invoices');
      if (req.body.amountCents > i.amount_cents) throw bad('A credit note can’t exceed the invoice');
      const { rows: [cn] } = await db.query(`INSERT INTO invoices (number, org_id, campaign_id, booking_id, kind, basis, amount_cents, status, issued_at) VALUES ('CR-' || nextval('invoice_number_seq'), $1, $2, $3, 'credit_note', $4, $5, 'issued', now()) RETURNING *`,
        [i.org_id, i.campaign_id, i.booking_id, `Credit against ${i.number}: ${req.body.reason}`, -req.body.amountCents]);
      await audit(db, req, 'invoice.credit_note', 'invoice', cn.id, { against: i.number, ...req.body });
      reply.code(201);
      return cn;
    });
  });

  // ---------------------------------------------------------------- seller ledger
  app.get('/ledger', async (req) => {
    const m = member(req, FIN);
    return (await pool.query(`SELECT e.*, sp.display_name AS seller FROM ledger_entries e JOIN seller_profiles sp ON sp.user_id = e.seller_id
      WHERE ${OWNS('e.booking_id', '$1')} AND ($2::uuid IS NULL OR e.seller_id = $2) AND ($3::text IS NULL OR e.status = $3) ORDER BY e.created_at DESC`, [m.orgId, req.query.sellerId ?? null, req.query.status ?? null])).rows;
  });

  app.get('/seller/earnings', async (req) => {
    const u = user(req);
    const { rows: lines } = await pool.query(`SELECT e.id, e.kind, e.basis, e.amount_cents, e.status, e.created_at, c.name AS campaign, p.status AS payout_status FROM ledger_entries e
      LEFT JOIN bookings b ON b.id = e.booking_id LEFT JOIN campaigns c ON c.id = b.campaign_id LEFT JOIN payouts p ON p.id = e.payout_id WHERE e.seller_id = $1 ORDER BY e.created_at DESC`, [u.id]);
    const total = (st) => lines.filter((l) => st.includes(l.status)).reduce((s, l) => s + l.amount_cents, 0);
    return { provisionalCents: total(['provisional']), lockedCents: total(['locked', 'scheduled']), paidCents: total(['paid']), onHoldCents: total(['on_hold']), pendingApprovalCents: total(['pending_approval']), lines };
  });

  app.get('/seller/payouts', async (req) => {
    const u = user(req);
    return (await pool.query('SELECT p.*, r.executed_at FROM payouts p JOIN payout_runs r ON r.id = p.run_id WHERE p.seller_id = $1 ORDER BY r.created_at DESC', [u.id])).rows;
  });

  /** Large adjustments start as pending_approval; a different person approves them with their own session. */
  app.post('/ledger/adjustments', { schema: body({ bookingId: 'uuid', amountCents: 'integer', reason: 'string' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      if (req.body.amountCents === 0) throw bad('Amount can’t be zero');
      const b = await finBooking(db, req, req.body.bookingId);
      if (!b.seller_id) throw conflict('This booking has no seller');
      const needsApproval = Math.abs(req.body.amountCents) > (await setting(db, 'adjustment_approval_cents'));
      const { rows: [e] } = await db.query(`INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status, reason, created_by) VALUES ($1, $2, 'adjustment', $3, $4, $5, $3, $6) RETURNING *`,
        [b.seller_id, b.id, req.body.reason, req.body.amountCents, needsApproval ? 'pending_approval' : 'locked', req.user.id]);
      await audit(db, req, 'ledger.adjustment', 'ledger_entry', e.id, { ...req.body, needsApproval });
      if (needsApproval) await notify(db, (await orgUsers(db, b.ops_org, ['finance_admin', 'location_manager'])).filter((id) => id !== req.user.id), 'approval', `Ledger adjustment of $${(req.body.amountCents / 100).toFixed(2)} needs a second approver`);
      else await notify(db, [b.seller_id], 'earnings', `Adjustment to your earnings: ${req.body.reason}`);
      reply.code(201);
      return e;
    });
  });

  app.post('/ledger/adjustments/:id/approve', async (req) => {
    const m = member(req, ['finance_admin', 'location_manager']);
    return tx(pool, async (db) => {
      const e = await one(db, `SELECT e.* FROM ledger_entries e WHERE e.id = $1 AND ${OWNS('e.booking_id', '$2')} FOR UPDATE OF e`, [req.params.id, m.orgId], 'Adjustment not found');
      if (e.status !== 'pending_approval') throw conflict('This adjustment isn’t waiting for approval');
      if (e.created_by === req.user.id) throw conflict('A different person must approve this adjustment', 'same_approver');
      await db.query(`UPDATE ledger_entries SET status = 'locked', approved_by = $2 WHERE id = $1`, [e.id, req.user.id]);
      await audit(db, req, 'ledger.adjustment_approved', 'ledger_entry', e.id);
      await notify(db, [e.seller_id], 'earnings', `Adjustment to your earnings: ${e.reason}`);
      return { status: 'locked' };
    });
  });

  // ---------------------------------------------------------------- payout runs
  app.post('/payout-runs', async (req, reply) => {
    const m = member(req, FIN);
    return tx(pool, async (db) => {
      // One run builder at a time per organization, and the claimed lines are locked: no line can be paid twice.
      await db.query(`SELECT pg_advisory_xact_lock(hashtext('payout_runs:' || $1::text))`, [m.orgId]);
      const { rows: lines } = await db.query(`SELECT e.id, e.seller_id, e.amount_cents, sp.display_name, sp.payout_verified, sp.tax_form_on_file
        FROM ledger_entries e JOIN seller_profiles sp ON sp.user_id = e.seller_id WHERE e.status = 'locked' AND ${OWNS('e.booking_id', '$1')} FOR UPDATE OF e`, [m.orgId]);
      const bySeller = new Map();
      for (const l of lines) bySeller.set(l.seller_id, [...(bySeller.get(l.seller_id) ?? []), l]);
      const held = [];
      const pay = [];
      for (const [sellerId, ls] of bySeller) {
        const total = ls.reduce((t, l) => t + l.amount_cents, 0);
        if (total <= 0) continue;
        const s = ls[0];
        if (!s.payout_verified) held.push({ sellerId, seller: s.display_name, amountCents: total, reason: 'Payout account not verified' });
        else if (!s.tax_form_on_file) held.push({ sellerId, seller: s.display_name, amountCents: total, reason: 'Tax form missing' });
        else pay.push({ sellerId, seller: s.display_name, ids: ls.map((l) => l.id), total });
      }
      if (!pay.length) return { run: null, payouts: [], held };
      const { rows: [run] } = await db.query('INSERT INTO payout_runs (org_id, total_cents, created_by) VALUES ($1, $2, $3) RETURNING *', [m.orgId, pay.reduce((t, s) => t + s.total, 0), req.user.id]);
      const payouts = [];
      for (const s of pay) {
        const { rows: [p] } = await db.query('INSERT INTO payouts (run_id, seller_id, amount_cents, idempotency_key) VALUES ($1, $2, $3, $4) RETURNING *', [run.id, s.sellerId, s.total, `${run.id}:${s.sellerId}`]);
        const { rows: claimed } = await db.query(`UPDATE ledger_entries SET status = 'scheduled', payout_id = $2 WHERE id = ANY($1) AND status = 'locked' RETURNING amount_cents`, [s.ids, p.id]);
        if (claimed.reduce((t, l) => t + l.amount_cents, 0) !== s.total) throw conflict('Ledger changed while building the run; try again', 'ledger_changed');
        payouts.push({ ...p, seller: s.seller });
      }
      await audit(db, req, 'payout_run.created', 'payout_run', run.id, { totalCents: run.total_cents, held: held.length });
      reply.code(201);
      return { run, payouts, held };
    });
  });

  async function finRun(db, req, id) {
    const m = member(req, FIN);
    return one(db, 'SELECT * FROM payout_runs WHERE id = $1 AND org_id = $2 FOR UPDATE', [id, m.orgId], 'Payout run not found');
  }

  app.post('/payout-runs/:id/approve', async (req) => {
    return tx(pool, async (db) => {
      const run = await finRun(db, req, req.params.id);
      if (run.status !== 'draft') throw conflict(`Run is already ${run.status}`);
      if (run.approvals.includes(req.user.id)) throw conflict('You already approved this run; a different person must give the second approval', 'same_approver');
      const approvals = [...run.approvals, req.user.id];
      const needed = run.total_cents > (await setting(db, 'payout_two_approval_cents')) ? 2 : 1;
      const status = approvals.length >= needed ? 'approved' : 'draft';
      await db.query('UPDATE payout_runs SET approvals = $2, status = $3 WHERE id = $1', [run.id, approvals, status]);
      await audit(db, req, 'payout_run.approved', 'payout_run', run.id, { approvals: approvals.length, needed });
      return { status, approvals: approvals.length, needed };
    });
  });

  /** Simulates the payment provider sending the payouts. failSellerIds lets tests and demos exercise failures. */
  app.post('/payout-runs/:id/execute', { schema: body({ failSellerIds: 'uuids?', failureReason: 'string?' }) }, async (req) => {
    return tx(pool, async (db) => {
      const run = await finRun(db, req, req.params.id);
      if (run.status !== 'approved') throw conflict('Approve the run first', 'not_approved');
      const fail = new Set(req.body.failSellerIds ?? []);
      const { rows: payouts } = await db.query('SELECT * FROM payouts WHERE run_id = $1', [run.id]);
      for (const p of payouts) {
        if (fail.has(p.seller_id)) {
          await db.query(`UPDATE payouts SET status = 'failed', failure_reason = $2, attempts = attempts + 1 WHERE id = $1`, [p.id, req.body.failureReason ?? 'Rejected by the bank']);
          await notify(db, [p.seller_id], 'payout', `Your payout failed: ${req.body.failureReason ?? 'Rejected by the bank'}. Update your payout account and we’ll retry.`);
        } else {
          await db.query(`UPDATE payouts SET status = 'paid', attempts = attempts + 1 WHERE id = $1`, [p.id]);
          await db.query(`UPDATE ledger_entries SET status = 'paid' WHERE payout_id = $1`, [p.id]);
          await notify(db, [p.seller_id], 'payout', `Payout sent: $${(p.amount_cents / 100).toFixed(2)}`);
        }
      }
      await db.query(`UPDATE payout_runs SET status = 'executed', executed_at = now() WHERE id = $1`, [run.id]);
      await audit(db, req, 'payout_run.executed', 'payout_run', run.id, { failed: [...fail] });
      return { status: 'executed', paid: payouts.filter((p) => !fail.has(p.seller_id)).length, failed: payouts.filter((p) => fail.has(p.seller_id)).length };
    });
  });

  app.post('/payouts/:id/retry', async (req) => {
    const m = member(req, FIN);
    return tx(pool, async (db) => {
      const p = await one(db, `SELECT p.*, sp.payout_verified FROM payouts p JOIN payout_runs r ON r.id = p.run_id JOIN seller_profiles sp ON sp.user_id = p.seller_id WHERE p.id = $1 AND r.org_id = $2 FOR UPDATE OF p`, [req.params.id, m.orgId], 'Payout not found');
      if (p.status !== 'failed') throw conflict('Only failed payouts can be retried');
      if (!p.payout_verified) throw conflict('The seller hasn’t fixed their payout account yet', 'payout_account');
      await db.query(`UPDATE payouts SET status = 'paid', failure_reason = NULL, attempts = attempts + 1 WHERE id = $1`, [p.id]);
      await db.query(`UPDATE ledger_entries SET status = 'paid' WHERE payout_id = $1`, [p.id]);
      await audit(db, req, 'payout.retried', 'payout', p.id);
      await notify(db, [p.seller_id], 'payout', `Payout sent: $${(p.amount_cents / 100).toFixed(2)}`);
      return { status: 'paid' };
    });
  });

  // ---------------------------------------------------------------- disputes
  app.post('/disputes', { schema: body({ type: { enum: ['invoice', 'attribution', 'commission', 'deliverables', 'cancellation_fee'] }, bookingId: 'uuid?', invoiceId: 'uuid?', amountCents: { type: 'integer', minimum: 0 }, claim: 'text' }) }, async (req, reply) => {
    const u = user(req);
    const b = req.body;
    return tx(pool, async (db) => {
      let bk = null;
      let heldCents = 0;
      // Only the records that were authorized are stored on the dispute.
      let bookingId = null;
      let invoiceId = null;
      if (['invoice', 'cancellation_fee'].includes(b.type)) {
        if (!b.invoiceId) throw bad('Say which invoice');
        const inv = await one(db, 'SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [b.invoiceId], 'Invoice not found');
        if (req.membership?.orgId !== inv.org_id || !BRAND_BILLING.includes(req.membership.role)) throw notFound('Invoice not found');
        if (b.bookingId && b.bookingId !== inv.booking_id) throw bad('That session doesn’t belong to this invoice');
        assertMove('invoice', inv.status, 'disputed');
        await db.query(`UPDATE invoices SET status = 'disputed' WHERE id = $1`, [inv.id]); // amount paused, not cancelled
        [bookingId, invoiceId] = [inv.booking_id, inv.id];
      } else {
        if (!b.bookingId) throw bad('Say which session');
        if (b.invoiceId) throw bad('Session disputes don’t take an invoice; open an invoice dispute instead');
        bk = await one(db, `SELECT b.*, c.org_id AS brand_org, c.status AS campaign_status FROM bookings b JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = $1 FOR UPDATE OF b`, [b.bookingId], 'Booking not found');
        const asBrand = req.membership?.orgId === bk.brand_org && BRAND.includes(req.membership.role);
        if (!asBrand && bk.seller_id !== u.id) throw notFound('Booking not found');
        bookingId = bk.id;
        if (bk.status !== 'completed') throw conflict('Disputes open after the session is completed');
        const windowDays = await setting(db, 'dispute_window_days');
        if (bk.locked_at && Date.now() - bk.locked_at.getTime() > windowDays * 864e5) throw conflict(`Disputes close ${windowDays} days after results lock`, 'dispute_window_closed');
        const { rows: open } = await db.query(`SELECT 1 FROM disputes WHERE booking_id = $1 AND type = $2 AND status = 'open'`, [bk.id, b.type]);
        if (open.length) throw conflict('There is already an open dispute of this type for this session', 'dispute_open');
        if (asBrand && bk.seller_id && b.amountCents > 0) {
          // Hold at most what the seller hasn't been paid yet for this session.
          const { rows: [{ unpaid }] } = await db.query(`SELECT COALESCE(sum(amount_cents), 0)::int AS unpaid FROM ledger_entries WHERE booking_id = $1 AND status IN ${UNPAID}`, [bk.id]);
          heldCents = Math.min(b.amountCents, Math.max(0, unpaid));
        }
      }
      const { rows: [d] } = await db.query('INSERT INTO disputes (type, opened_by, booking_id, invoice_id, amount_cents, claim) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [b.type, u.id, bookingId, invoiceId, b.amountCents, b.claim]);
      if (heldCents > 0) {
        await db.query(`INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status, reason, created_by) VALUES ($1, $2, 'adjustment', $3, $4, 'locked', $5, $6), ($1, $2, 'adjustment', $3, $7, 'on_hold', $5, $6)`,
          [bk.seller_id, bk.id, 'Held while dispute is open', -heldCents, `dispute_hold:${d.id}`, u.id, heldCents]);
        await notify(db, [bk.seller_id], 'dispute', `A brand opened a dispute on your session; $${(heldCents / 100).toFixed(2)} is on hold.`);
      }
      if (bk && b.type === 'deliverables' && bk.campaign_status === 'completed' && bk.seller_id !== u.id) await db.query(`UPDATE campaigns SET status = 'disputed' WHERE id = $1`, [bk.campaign_id]);
      await audit(db, req, 'dispute.opened', 'dispute', d.id, { ...b, heldCents });
      reply.code(201);
      return { ...d, heldCents };
    });
  });

  async function disputeFor(db, req, lock = false) {
    const u = user(req);
    const d = await one(db, `SELECT d.*, b.seller_id, c.org_id AS brand_org, i.org_id AS invoice_org,
        COALESCE(d.booking_id, i.booking_id) AS any_booking FROM disputes d LEFT JOIN bookings b ON b.id = d.booking_id LEFT JOIN campaigns c ON c.id = b.campaign_id LEFT JOIN invoices i ON i.id = d.invoice_id
        WHERE d.id = $1${lock ? ' FOR UPDATE OF d' : ''}`, [req.params.id], 'Dispute not found');
    // Platform and finance staff count as parties only with a session that passed MFA (same rule as everywhere else).
    const mfa = Boolean(req.session?.mfaPassed);
    let finance = false;
    if (req.membership?.role === 'finance_admin' && mfa) finance = (await db.query(`SELECT ${OWNS('$1::uuid', '$2')} AS ok`, [d.any_booking, req.membership.orgId])).rows[0].ok;
    const party = (u.is_super_admin && mfa) || d.opened_by === u.id || d.seller_id === u.id || [d.brand_org, d.invoice_org].includes(req.membership?.orgId) || finance;
    if (!party) throw notFound('Dispute not found');
    return d;
  }

  app.get('/disputes', async (req) => {
    const u = user(req);
    if (u.is_super_admin) {
      requireMfa(req);
      return (await pool.query(`SELECT * FROM disputes WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at`, [req.query.status ?? null])).rows;
    }
    const m = member(req, FIN);
    return (await pool.query(`SELECT d.* FROM disputes d LEFT JOIN invoices i ON i.id = d.invoice_id WHERE ${OWNS('COALESCE(d.booking_id, i.booking_id)', '$1')} AND ($2::text IS NULL OR d.status = $2) ORDER BY d.created_at`, [m.orgId, req.query.status ?? null])).rows;
  });

  app.get('/disputes/:id', async (req) => disputeFor(pool, req));

  app.post('/disputes/:id/evidence', { schema: body({ note: 'text' }) }, async (req) => {
    return tx(pool, async (db) => {
      const d = await disputeFor(db, req, true);
      if (d.status !== 'open') throw conflict('This dispute is decided');
      await db.query(`UPDATE disputes SET evidence = evidence || jsonb_build_array(jsonb_build_object('by', $2::text, 'note', $3::text, 'at', now())) WHERE id = $1`, [d.id, req.user.id, req.body.note]);
      return { ok: true };
    });
  });

  /**
   * outcomeCents means: invoice dispute → credit to the brand; brand session dispute → amount taken from the held pay (never more than was held);
   * seller dispute → amount added to the seller.
   */
  app.post('/disputes/:id/decide', { schema: body({ decision: 'text', outcomeCents: { type: 'integer', minimum: 0 } }) }, async (req) => {
    const admin = superAdmin(req);
    return tx(pool, async (db) => {
      const d = await disputeFor(db, req, true);
      if (d.status !== 'open') throw conflict('Already decided');
      const out = req.body.outcomeCents;
      if (d.invoice_id) {
        const inv = await one(db, 'SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [d.invoice_id]);
        if (out > inv.amount_cents) throw bad('Credit can’t exceed the invoice');
        if (out > 0) await db.query(`INSERT INTO invoices (number, org_id, campaign_id, booking_id, kind, basis, amount_cents, status, issued_at) VALUES ('CR-' || nextval('invoice_number_seq'), $1, $2, $3, 'credit_note', $4, $5, 'issued', now())`, [inv.org_id, inv.campaign_id, inv.booking_id, `Dispute outcome on ${inv.number}`, -out]);
        await db.query('UPDATE invoices SET status = $2 WHERE id = $1', [inv.id, out >= inv.amount_cents ? 'credited' : 'issued']);
      } else if (d.opened_by === d.seller_id) {
        if (out > 0) await db.query(`INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status, reason, created_by) VALUES ($1, $2, 'adjustment', $3, $4, 'locked', $5, $6)`, [d.seller_id, d.booking_id, `Dispute outcome: ${req.body.decision}`, out, `dispute:${d.id}`, admin.id]);
      } else {
        const { rows: [hold] } = await db.query(`SELECT * FROM ledger_entries WHERE reason = $1 AND status = 'on_hold' FOR UPDATE`, [`dispute_hold:${d.id}`]);
        const held = hold?.amount_cents ?? 0;
        if (out > held) throw bad(`Outcome can’t exceed the held amount ($${(held / 100).toFixed(2)})`);
        if (hold) await db.query(`UPDATE ledger_entries SET status = 'locked' WHERE id = $1`, [hold.id]); // release the hold
        if (out > 0) await db.query(`INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status, reason, created_by) VALUES ($1, $2, 'adjustment', $3, $4, 'locked', $5, $6)`, [d.seller_id, d.booking_id, `Dispute outcome: ${req.body.decision}`, -out, `dispute:${d.id}`, admin.id]);
        await db.query(`UPDATE campaigns SET status = 'completed' WHERE status = 'disputed' AND id = (SELECT campaign_id FROM bookings WHERE id = $1)`, [d.booking_id]);
      }
      await db.query(`UPDATE disputes SET status = 'decided', decision = $2, outcome_cents = $3, decided_by = $4, decided_at = now() WHERE id = $1`, [d.id, req.body.decision, out, admin.id]);
      await audit(db, req, 'dispute.decided', 'dispute', d.id, req.body);
      await notify(db, [d.opened_by, d.seller_id, ...(d.brand_org ? await orgUsers(db, d.brand_org, ['brand_owner']) : [])], 'dispute', `Dispute decided: ${req.body.decision}`);
      return { status: 'decided', outcomeCents: out };
    });
  });

  // ---------------------------------------------------------------- reports and overview
  app.get('/campaigns/:id/report', async (req) => {
    const m = member(req, BRAND);
    const c = await one(pool, 'SELECT * FROM campaigns WHERE id = $1 AND org_id = $2', [req.params.id, m.orgId], 'Campaign not found');
    const { rows: [bk] } = await pool.query(`SELECT id, results_status FROM bookings WHERE campaign_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1`, [c.id]);
    if (!bk) return { campaign: c.name, status: c.status, results: null, note: 'Results appear after the LIVE' };
    const { liveMinutes, s } = await loadSettlement(pool, bk.id);
    const [{ rows: incidents }, { rows: invoices }] = await Promise.all([
      pool.query('SELECT category, severity, description, minutes_lost, status FROM incidents WHERE booking_id = $1', [bk.id]),
      pool.query('SELECT number, kind, basis, amount_cents, status FROM invoices WHERE booking_id = $1 ORDER BY created_at', [bk.id]),
    ]);
    const costCents = invoices.filter((i) => i.status !== 'void' && i.status !== 'draft').reduce((t, i) => t + i.amount_cents, 0);
    return {
      campaign: c.name, status: c.status, final: bk.results_status === 'locked',
      results: { orders: s.orders, gmvCents: s.gmvCents, refundsCents: s.refundsCents, netSalesCents: s.gmvCents - s.refundsCents, liveMinutes, gmvPerHourCents: liveMinutes ? Math.round((s.gmvCents * 60) / liveMinutes) : null, averageOrderCents: s.orders ? Math.round(s.gmvCents / s.orders) : null, conversionRate: null },
      sources: { orders: bk.results_status === 'pending' ? 'Delayed' : 'Imported', liveHours: 'Verified', conversionRate: 'Unavailable' },
      campaignCostCents: costCents, gmvToCostRatio: costCents ? Math.round((s.gmvCents / costCents) * 10) / 10 : null,
      definitions: { gmv: 'Your merchandise sales in TikTok Shop attributed to the LIVE. Not Vyralink or Creator Hub revenue.', campaignCost: 'Fees invoiced by Creator Hub for this campaign.' },
      incidents, invoices,
    };
  });

  app.get('/finance/overview', async (req) => {
    const m = member(req, FIN);
    const { rows: [r] } = await pool.query(`SELECT
        COALESCE(sum(amount_cents) FILTER (WHERE status IN ('issued', 'paid', 'overdue', 'credited') AND kind IN ('production', 'performance', 'cancellation', 'credit_note')), 0)::int AS recognized_revenue_cents,
        COALESCE(sum(amount_cents) FILTER (WHERE status = 'draft'), 0)::int AS pending_invoices_cents,
        COALESCE(sum(amount_cents) FILTER (WHERE status IN ('issued', 'overdue', 'disputed') AND kind <> 'credit_note'), 0)::int AS receivable_cents,
        COALESCE(sum(amount_cents) FILTER (WHERE status = 'overdue'), 0)::int AS overdue_cents
      FROM invoices i WHERE ${OWNS('i.booking_id', '$1')}`, [m.orgId]);
    const { rows: [l] } = await pool.query(`SELECT COALESCE(sum(amount_cents) FILTER (WHERE status = 'paid'), 0)::int AS paid_cents, COALESCE(sum(amount_cents) FILTER (WHERE status IN ('provisional', 'locked', 'scheduled', 'on_hold')), 0)::int AS accrued_cents FROM ledger_entries e WHERE ${OWNS('e.booking_id', '$1')}`, [m.orgId]);
    const { rows: [g] } = await pool.query(`SELECT COALESCE(sum(amount_cents), 0)::bigint AS gmv_cents FROM session_orders so WHERE so.attributed AND so.status <> 'cancelled' AND ${OWNS('so.booking_id', '$1')}`, [m.orgId]);
    const { rows: [q] } = await pool.query(`SELECT count(*) FILTER (WHERE status = 'completed' AND results_status = 'imported' AND returns_window_ends_at < now())::int AS ready_to_lock FROM bookings bk WHERE ${OWNS('bk.id', '$1')}`, [m.orgId]);
    return { ...r, sellerCompensation: l, brandGmvContextCents: Number(g.gmv_cents), workQueue: q, note: 'Revenue counts Creator Hub fees only. GMV is brand sales, shown for context.' };
  });
}
