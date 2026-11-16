// Products, campaigns, job marketplace, invitations, contracts, booth holds, cancellation, messages
// (blueprint B05–B08, B12–B14, B17, C09–C12, BF02–BF08).
import { setting, tx } from '../db.js';
import { audit, bad, body, conflict, forbidden, member, notify, notFound, one, orgUsers, platformStaff, superAdmin, user, BRAND, OWNER } from '../http.js';
import { cancellationFee } from '../money.js';
import { ownFile } from './files.js';
import { assertMove } from '../status.js';

export const ARRIVAL_LEAD_MIN = 45; // ponytail: fixed 45 min before start (blueprint: arrive 6:15 for 7:00); make per-campaign if brands ask.

const ACTIVE_BOOKING = `('hold', 'confirmed', 'checked_in', 'in_progress')`;

async function brandCampaign(db, req, id, lock = false) {
  const m = member(req, BRAND);
  const c = await one(db, `SELECT * FROM campaigns WHERE id = $1 AND org_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, m.orgId], 'Campaign not found');
  return { m, c };
}

async function expireStale(db) {
  await db.query(`UPDATE invitations SET status = 'expired' WHERE status IN ('invited', 'viewed', 'countered', 'applied') AND expires_at < now()`);
  await db.query(`UPDATE bookings SET status = 'expired' WHERE status = 'hold' AND hold_expires_at < now()`);
}

/** Inserts a booking row, turning an exclusion violation into a message naming the conflicting booking. */
export async function insertBooking(db, { boothId, campaignId, start, end, sellerId = null }) {
  const loc = await one(db, 'SELECT l.* FROM booths b JOIN locations l ON l.id = b.location_id WHERE b.id = $1', [boothId], 'Booth not found');
  const code = `VL-${Math.floor(1000 + Math.random() * 9000)}`;
  await db.query('SAVEPOINT booking_insert');
  try {
    const { rows: [bk] } = await db.query(
      `INSERT INTO bookings (booth_id, campaign_id, seller_id, starts_at, ends_at, slot, hold_expires_at, checkin_code)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, tstzrange($4::timestamptz - make_interval(mins => $6), $5::timestamptz + make_interval(mins => $7)), now() + make_interval(hours => $8), $9) RETURNING *`,
      [boothId, campaignId, sellerId, start, end, loc.setup_min, loc.teardown_min, loc.hold_hours, code]);
    return bk;
  } catch (err) {
    await db.query('ROLLBACK TO SAVEPOINT booking_insert');
    if (err.code === '23P01') {
      const { rows } = await db.query(
        `SELECT b.starts_at, b.ends_at, bo.name AS booth FROM bookings b JOIN booths bo ON bo.id = b.booth_id
         WHERE b.booth_id = $1 AND b.status IN ${ACTIVE_BOOKING} AND b.slot && tstzrange($2::timestamptz - make_interval(mins => $4), $3::timestamptz + make_interval(mins => $5)) LIMIT 1`,
        [boothId, start, end, loc.setup_min, loc.teardown_min]);
      if (rows[0]) err.friendly = `${rows[0].booth} is already booked ${rows[0].starts_at.toISOString()}–${rows[0].ends_at.toISOString()} (with setup and teardown). Choose another booth or time.`;
    }
    throw err;
  }
}

const campaignBody = { name: 'string', type: { enum: ['live_shopping', 'live_drop'] }, productIds: 'uuids', locationId: 'uuid?', startsAt: 'datetime', endsAt: 'datetime', baseRateCents: 'integer', commissionBps: 'integer?', bonusCents: 'integer?', bonusGmvThresholdCents: 'integer?', productionFeeCents: 'integer', performanceFeeBps: 'integer?', budgetCapCents: 'integer', targetGmvCents: 'integer?', requiredCourses: 'strings?', requiredCategory: 'string?' };

export default async function catalog(app) {
  const { pool } = app;

  // ---------------------------------------------------------------- products
  app.post('/products', { schema: body({ name: 'string', sku: 'string', priceCents: { type: 'integer', minimum: 1 }, category: 'string', inventory: 'integer?', samplesAvailable: 'integer?', commissionBps: 'integer?', description: 'text?', sellingPoints: 'strings?', restrictedClaims: 'strings?', imageFileId: 'uuid?' }) }, async (req, reply) => {
    const m = member(req, BRAND);
    const b = req.body;
    const image = b.imageFileId ? await ownFile(pool, m.orgId, b.imageFileId, 'product_image') : null;
    const { rows: [p] } = await pool.query(
      `INSERT INTO products (org_id, name, sku, price_cents, category, inventory, samples_available, commission_bps, description, selling_points, restricted_claims, image_file_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, 0), COALESCE($8, (SELECT (value)::int FROM settings WHERE key = 'default_commission_bps')), COALESCE($9, ''), COALESCE($10::text[], '{}'), COALESCE($11::text[], '{}'), $12) RETURNING *`,
      [m.orgId, b.name, b.sku, b.priceCents, b.category, b.inventory ?? null, b.samplesAvailable ?? null, b.commissionBps ?? null, b.description ?? null, b.sellingPoints ?? null, b.restrictedClaims ?? null, image]);
    await audit(pool, req, 'product.created', 'product', p.id);
    reply.code(201);
    return p;
  });

  app.get('/products', async (req) => {
    const m = member(req, BRAND);
    return (await pool.query('SELECT * FROM products WHERE org_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY name', [m.orgId, req.query.status ?? null])).rows;
  });

  app.get('/products/:id', async (req) => {
    const m = member(req, BRAND);
    return one(pool, 'SELECT * FROM products WHERE id = $1 AND org_id = $2', [req.params.id, m.orgId], 'Product not found');
  });

  app.patch('/products/:id', { schema: body({ name: 'string?', priceCents: 'integer?', inventory: 'integer?', samplesAvailable: 'integer?', commissionBps: 'integer?', description: 'text?', sellingPoints: 'strings?', restrictedClaims: 'strings?', imageFileId: 'uuid?' }) }, async (req) => {
    const m = member(req, BRAND);
    const b = req.body;
    return tx(pool, async (db) => {
      if (b.imageFileId) await db.query('UPDATE products SET image_file_id = $3 WHERE id = $1 AND org_id = $2', [req.params.id, m.orgId, await ownFile(db, m.orgId, b.imageFileId, 'product_image')]);
      const p = await one(db, 'SELECT * FROM products WHERE id = $1 AND org_id = $2 FOR UPDATE', [req.params.id, m.orgId], 'Product not found');
      // Changing what sellers may say (or the name they say it about) sends an approved product back to review.
      const changed = (k, col) => b[k] !== undefined && JSON.stringify(b[k]) !== JSON.stringify(p[col]);
      const claimsChanged = p.status === 'approved' && (changed('name', 'name') || changed('description', 'description') || changed('sellingPoints', 'selling_points') || changed('restrictedClaims', 'restricted_claims'));
      const { rows: [u] } = await db.query(
        `UPDATE products SET name = COALESCE($2, name), price_cents = COALESCE($3, price_cents), inventory = COALESCE($4, inventory), samples_available = COALESCE($5, samples_available),
           commission_bps = COALESCE($6, commission_bps), description = COALESCE($7, description), selling_points = COALESCE($8, selling_points), restricted_claims = COALESCE($9, restricted_claims),
           status = CASE WHEN $10 THEN 'pending_review' ELSE status END WHERE id = $1 RETURNING *`,
        [p.id, b.name ?? null, b.priceCents ?? null, b.inventory ?? null, b.samplesAvailable ?? null, b.commissionBps ?? null, b.description ?? null, b.sellingPoints ?? null, b.restrictedClaims ?? null, Boolean(claimsChanged)]);
      await audit(db, req, 'product.updated', 'product', p.id, { backToReview: Boolean(claimsChanged) });
      return u;
    });
  });

  app.post('/products/:id/submit', async (req) => {
    const m = member(req, BRAND);
    return tx(pool, async (db) => {
      const p = await one(db, 'SELECT status FROM products WHERE id = $1 AND org_id = $2 FOR UPDATE', [req.params.id, m.orgId], 'Product not found');
      assertMove('product', p.status, 'pending_review');
      await db.query(`UPDATE products SET status = 'pending_review', review_note = NULL WHERE id = $1`, [req.params.id]);
      await audit(db, req, 'product.submitted', 'product', req.params.id);
      return { status: 'pending_review' };
    });
  });

  app.post('/products/:id/archive', async (req) => {
    const m = member(req, BRAND);
    return tx(pool, async (db) => {
      const p = await one(db, 'SELECT status FROM products WHERE id = $1 AND org_id = $2 FOR UPDATE', [req.params.id, m.orgId], 'Product not found');
      const { rows } = await db.query(`SELECT 1 FROM campaigns WHERE $1 = ANY(product_ids) AND status IN ('scheduled', 'in_progress')`, [req.params.id]);
      if (rows.length) throw conflict('This product is in a scheduled or running campaign');
      assertMove('product', p.status, 'archived');
      await db.query(`UPDATE products SET status = 'archived' WHERE id = $1`, [req.params.id]);
      return { status: 'archived' };
    });
  });

  app.get('/admin/products', async (req) => {
    platformStaff(req);
    return (await pool.query(`SELECT p.*, o.name AS brand FROM products p JOIN orgs o ON o.id = p.org_id WHERE p.status = COALESCE($1, 'pending_review') ORDER BY p.created_at`, [req.query.status ?? null])).rows;
  });

  app.post('/admin/products/:id/decision', { schema: body({ decision: { enum: ['approve', 'reject'] }, note: 'text?' }) }, async (req) => {
    superAdmin(req);
    if (req.body.decision === 'reject' && !req.body.note) throw bad('Explain what needs to change (note)');
    return tx(pool, async (db) => {
      const p = await one(db, 'SELECT * FROM products WHERE id = $1 FOR UPDATE', [req.params.id], 'Product not found');
      const to = req.body.decision === 'approve' ? 'approved' : 'rejected';
      assertMove('product', p.status, to);
      await db.query('UPDATE products SET status = $2, review_note = $3 WHERE id = $1', [p.id, to, req.body.note ?? null]);
      await audit(db, req, `product.${to}`, 'product', p.id, { note: req.body.note });
      await notify(db, await orgUsers(db, p.org_id, BRAND), 'product', to === 'approved' ? `${p.name} is approved` : `${p.name} needs changes: ${req.body.note}`);
      return { status: to };
    });
  });

  // ---------------------------------------------------------------- campaigns
  app.post('/campaigns', { schema: body(campaignBody) }, async (req, reply) => {
    const m = member(req, BRAND);
    const b = req.body;
    return tx(pool, async (db) => {
      const { rows: prods } = await db.query(`SELECT id, status, inventory FROM products WHERE id = ANY($1) AND org_id = $2`, [b.productIds, m.orgId]);
      if (prods.length !== b.productIds.length || !prods.length) throw bad('Pick at least one of your own products');
      if (prods.some((p) => p.status !== 'approved')) throw conflict('Only approved products can be used in a campaign', 'product_not_approved');
      const perf = b.performanceFeeBps ?? (await setting(db, 'performance_fee_bps'));
      const comm = b.commissionBps ?? (await setting(db, 'default_commission_bps'));
      if (b.budgetCapCents < b.productionFeeCents) throw bad('Budget is below the production fee', 'budget_too_low');
      const { rows: [c] } = await db.query(
        `INSERT INTO campaigns (org_id, name, type, product_ids, location_id, starts_at, ends_at, base_rate_cents, commission_bps, bonus_cents, bonus_gmv_threshold_cents,
           production_fee_cents, performance_fee_bps, budget_cap_cents, target_gmv_cents, required_courses, required_category, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 0), $11, $12, $13, $14, $15, COALESCE($16::text[], '{}'), $17, $18) RETURNING *`,
        [m.orgId, b.name, b.type, b.productIds, b.locationId ?? null, b.startsAt, b.endsAt, b.baseRateCents, comm, b.bonusCents ?? null, b.bonusGmvThresholdCents ?? null, b.productionFeeCents, perf, b.budgetCapCents, b.targetGmvCents ?? null, b.requiredCourses ?? null, b.requiredCategory ?? null, req.user.id]);
      await audit(db, req, 'campaign.created', 'campaign', c.id);
      reply.code(201);
      return c;
    });
  });

  app.get('/campaigns', async (req) => {
    const m = member(req, BRAND);
    return (await pool.query('SELECT * FROM campaigns WHERE org_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY starts_at', [m.orgId, req.query.status ?? null])).rows;
  });

  app.get('/campaigns/:id', async (req) => {
    const { c } = await brandCampaign(pool, req, req.params.id);
    const [inv, con, bk] = await Promise.all([
      pool.query('SELECT i.*, sp.display_name FROM invitations i JOIN seller_profiles sp ON sp.user_id = i.seller_id WHERE campaign_id = $1 ORDER BY created_at', [c.id]),
      pool.query('SELECT * FROM contracts WHERE campaign_id = $1 ORDER BY version', [c.id]),
      // Explicit columns: the check-in code is for the seller and studio only.
      pool.query(`SELECT b.id, b.booth_id, b.seller_id, b.producer_id, b.starts_at, b.ends_at, b.status, b.hold_expires_at, b.checked_in_at, b.actual_start, b.actual_end,
          b.minutes_lost, b.partial, b.results_status, b.returns_window_ends_at, b.locked_at, bo.name AS booth
        FROM bookings b JOIN booths bo ON bo.id = b.booth_id WHERE campaign_id = $1 ORDER BY created_at`, [c.id]),
    ]);
    return { ...c, invitations: inv.rows, contracts: con.rows, bookings: bk.rows };
  });

  // Every field optional on edit; the type value is still checked by the database constraint.
  const patchBody = Object.fromEntries(Object.entries(campaignBody).filter(([k]) => k !== 'productIds').map(([k, v]) => [k, typeof v === 'string' ? (v.endsWith('?') ? v : `${v}?`) : 'string?']));
  app.patch('/campaigns/:id', { schema: body(patchBody) }, async (req) => {
    return tx(pool, async (db) => {
      const { c } = await brandCampaign(db, req, req.params.id, true);
      if (c.status !== 'draft') throw conflict('Only drafts can be edited; after publishing, money terms change through a new contract version');
      const b = req.body;
      const map = { name: 'name', type: 'type', locationId: 'location_id', startsAt: 'starts_at', endsAt: 'ends_at', baseRateCents: 'base_rate_cents', commissionBps: 'commission_bps', bonusCents: 'bonus_cents', bonusGmvThresholdCents: 'bonus_gmv_threshold_cents', productionFeeCents: 'production_fee_cents', performanceFeeBps: 'performance_fee_bps', budgetCapCents: 'budget_cap_cents', targetGmvCents: 'target_gmv_cents', requiredCourses: 'required_courses', requiredCategory: 'required_category' };
      const sets = Object.keys(b).filter((k) => map[k]);
      if (!sets.length) return c;
      const { rows: [u] } = await db.query(`UPDATE campaigns SET ${sets.map((k, i) => `${map[k]} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`, [c.id, ...sets.map((k) => b[k])]);
      return u;
    });
  });

  app.post('/campaigns/:id/publish', async (req) => {
    return tx(pool, async (db) => {
      const { m, c } = await brandCampaign(db, req, req.params.id, true);
      if (m.orgStatus !== 'verified') throw conflict('Verify your company before publishing', 'brand_not_verified');
      const threshold = await setting(db, 'approval_threshold_cents');
      const needsApproval = c.budget_cap_cents > threshold && m.role !== 'brand_owner';
      const to = needsApproval ? 'pending_approval' : 'published';
      assertMove('campaign', c.status, to);
      await db.query('UPDATE campaigns SET status = $2 WHERE id = $1', [c.id, to]);
      await audit(db, req, `campaign.${to}`, 'campaign', c.id);
      if (needsApproval) await notify(db, await orgUsers(db, m.orgId, OWNER), 'approval', `${c.name} needs your approval (budget over threshold)`, `/campaigns/${c.id}`);
      return { status: to };
    });
  });

  app.post('/campaigns/:id/approve', async (req) => {
    return tx(pool, async (db) => {
      const { m, c } = await brandCampaign(db, req, req.params.id, true);
      if (m.role !== 'brand_owner') throw forbidden('Only a Brand Owner can approve');
      assertMove('campaign', c.status, 'published');
      await db.query(`UPDATE campaigns SET status = 'published' WHERE id = $1`, [c.id]);
      await audit(db, req, 'campaign.approved', 'campaign', c.id);
      await notify(db, [c.created_by], 'approval', `${c.name} was approved and published`);
      return { status: 'published' };
    });
  });

  app.post('/campaigns/:id/decline', { schema: body({ note: 'text' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { m, c } = await brandCampaign(db, req, req.params.id, true);
      if (m.role !== 'brand_owner') throw forbidden('Only a Brand Owner can decline');
      assertMove('campaign', c.status, 'draft');
      await db.query(`UPDATE campaigns SET status = 'draft', approval_note = $2 WHERE id = $1`, [c.id, req.body.note]);
      await audit(db, req, 'campaign.declined', 'campaign', c.id, { note: req.body.note });
      await notify(db, [c.created_by], 'approval', `${c.name} went back to draft: ${req.body.note}`);
      return { status: 'draft' };
    });
  });

  // Fee is quoted first (confirm=false) and charged only on confirm=true.
  app.post('/campaigns/:id/cancel', { schema: body({ confirm: 'boolean' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { m, c } = await brandCampaign(db, req, req.params.id, true);
      if (m.role !== 'brand_owner') throw forbidden('Only a Brand Owner can cancel a campaign');
      assertMove('campaign', c.status, 'cancelled');
      const { rows: [bk] } = await db.query(`SELECT * FROM bookings WHERE campaign_id = $1 AND status IN ${ACTIVE_BOOKING} FOR UPDATE`, [c.id]);
      const hoursBefore = (new Date(c.starts_at).getTime() - Date.now()) / 3.6e6;
      const fee = bk && bk.status !== 'hold' ? cancellationFee(c.production_fee_cents, hoursBefore) : 0;
      if (!req.body.confirm) return { quote: { feeCents: fee, hoursBefore: Math.floor(hoursBefore), policy: 'Free more than 72 h before; 50% of the production fee 24–72 h; 100% within 24 h' } };
      await db.query(`UPDATE campaigns SET status = 'cancelled', cancel_fee_cents = $2 WHERE id = $1`, [c.id, fee]);
      await db.query(`UPDATE invitations SET status = 'withdrawn' WHERE campaign_id = $1 AND status IN ('invited', 'viewed', 'countered', 'applied')`, [c.id]);
      if (bk) await db.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [bk.id]);
      if (fee > 0) await db.query(`INSERT INTO invoices (number, org_id, campaign_id, booking_id, kind, basis, amount_cents, status, issued_at, due_at) VALUES ('INV-' || nextval('invoice_number_seq'), $1, $2, $3, 'cancellation', $4, $5, 'issued', now(), now() + interval '15 days')`, [c.org_id, c.id, bk.id, `Cancellation ${Math.floor(hoursBefore)} h before the LIVE`, fee]);
      await audit(db, req, 'campaign.cancelled', 'campaign', c.id, { feeCents: fee });
      if (bk) await notify(db, [bk.seller_id, bk.producer_id], 'booking', `${c.name} was cancelled by the brand`);
      return { status: 'cancelled', feeCents: fee };
    });
  });

  // ---------------------------------------------------------------- booth holds (campaign step 7)
  app.post('/campaigns/:id/hold', { schema: body({ boothId: 'uuid' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      const { m, c } = await brandCampaign(db, req, req.params.id, true);
      if (m.orgStatus !== 'verified') throw conflict('Verify your company before holding studio time', 'brand_not_verified');
      if (!['draft', 'pending_approval', 'published', 'recruiting'].includes(c.status)) throw conflict('This campaign can’t take a new hold');
      await expireStale(db);
      const { rows: active } = await db.query(`SELECT 1 FROM bookings WHERE campaign_id = $1 AND status IN ${ACTIVE_BOOKING}`, [c.id]);
      if (active.length) throw conflict('This campaign already holds a booth');
      // A brand can't tie up the studio with unlimited holds. The per-brand lock makes count-then-insert safe under concurrent requests.
      await db.query(`SELECT pg_advisory_xact_lock(hashtext('holds:' || $1::text))`, [m.orgId]);
      const { rows: [{ n }] } = await db.query(`SELECT count(*)::int AS n FROM bookings b JOIN campaigns c2 ON c2.id = b.campaign_id WHERE c2.org_id = $1 AND b.status = 'hold'`, [m.orgId]);
      if (n >= (await setting(db, 'max_active_holds_per_brand'))) throw conflict('Too many open holds. Confirm or release some first.', 'too_many_holds');
      const booth = await one(db, `SELECT b.*, l.status AS location_status FROM booths b JOIN locations l ON l.id = b.location_id WHERE b.id = $1`, [req.body.boothId], 'Booth not found');
      if (booth.status !== 'available') throw conflict(`${booth.name} is not available (${booth.status})`);
      if (booth.location_status === 'closed') throw conflict('This location is closed');
      const bk = await insertBooking(db, { boothId: booth.id, campaignId: c.id, start: c.starts_at, end: c.ends_at });
      await db.query('UPDATE campaigns SET location_id = $2 WHERE id = $1', [c.id, booth.location_id]);
      await audit(db, req, 'booking.hold_created', 'booking', bk.id);
      reply.code(201);
      return bk;
    });
  });

  // ---------------------------------------------------------------- job marketplace (seller side)
  app.get('/jobs', async (req) => {
    const u = user(req);
    await expireStale(pool);
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.type, o.name AS brand, c.starts_at, c.ends_at, c.base_rate_cents, c.commission_bps, c.bonus_cents, c.bonus_gmv_threshold_cents,
              c.required_courses, l.name AS location, l.address,
              (SELECT array_agg(p.name) FROM products p WHERE p.id = ANY(c.product_ids)) AS products,
              (SELECT status FROM invitations i WHERE i.campaign_id = c.id AND i.seller_id = $1) AS my_status,
              NOT EXISTS (SELECT 1 FROM unnest(c.required_courses) rc WHERE rc NOT IN (SELECT course FROM certificates WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now()))) AS trained
       FROM campaigns c JOIN orgs o ON o.id = c.org_id LEFT JOIN locations l ON l.id = c.location_id
       WHERE c.status IN ('published', 'recruiting') AND o.status = 'verified' AND c.starts_at > now() ORDER BY c.starts_at`, [u.id]);
    return rows;
  });

  app.post('/jobs/:campaignId/apply', { schema: body({ message: 'text?' }) }, async (req, reply) => {
    const u = user(req);
    return tx(pool, async (db) => {
      await one(db, 'SELECT 1 FROM seller_profiles WHERE user_id = $1 AND NOT paused', [u.id], 'Only active LIVE Sellers can apply');
      const c = await one(db, `SELECT * FROM campaigns WHERE id = $1 AND status IN ('published', 'recruiting') FOR UPDATE`, [req.params.campaignId], 'Job not found or closed');
      const exp = await setting(db, 'invite_expiry_hours');
      const { rows: [i] } = await db.query(
        `INSERT INTO invitations (campaign_id, seller_id, kind, status, terms, message, expires_at) VALUES ($1, $2, 'application', 'applied', $3, $4, now() + make_interval(hours => $5)) RETURNING *`,
        [c.id, u.id, { baseRateCents: c.base_rate_cents }, req.body.message ?? null, exp]);
      if (c.status === 'published') await db.query(`UPDATE campaigns SET status = 'recruiting' WHERE id = $1`, [c.id]);
      await notify(db, await orgUsers(db, c.org_id, BRAND), 'application', `New application for ${c.name}`);
      reply.code(201);
      return i;
    });
  });

  // ---------------------------------------------------------------- invitations
  app.post('/campaigns/:id/invitations', { schema: body({ sellerId: 'uuid', baseRateCents: 'integer?' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      const { m, c } = await brandCampaign(db, req, req.params.id, true);
      if (m.orgStatus !== 'verified') throw conflict('Verify your company before inviting sellers', 'brand_not_verified');
      if (!['published', 'recruiting'].includes(c.status)) throw conflict('Publish the campaign before inviting sellers');
      await assertNotBooked(db, c.id);
      await one(db, 'SELECT 1 FROM seller_profiles WHERE user_id = $1 AND NOT paused', [req.body.sellerId], 'Seller not found');
      const exp = await setting(db, 'invite_expiry_hours');
      const { rows: [i] } = await db.query(
        `INSERT INTO invitations (campaign_id, seller_id, terms, expires_at) VALUES ($1, $2, $3, now() + make_interval(hours => $4))
         ON CONFLICT (campaign_id, seller_id) DO UPDATE SET status = 'invited', terms = EXCLUDED.terms, counter = NULL, expires_at = EXCLUDED.expires_at
           WHERE invitations.status IN ('expired', 'declined', 'withdrawn') RETURNING *`,
        [c.id, req.body.sellerId, { baseRateCents: req.body.baseRateCents ?? c.base_rate_cents }, exp]);
      if (!i) throw conflict('This seller already has an open invitation or application for this campaign');
      if (c.status === 'published') await db.query(`UPDATE campaigns SET status = 'recruiting' WHERE id = $1`, [c.id]);
      await audit(db, req, 'invitation.sent', 'invitation', i.id);
      await notify(db, [req.body.sellerId], 'invitation', `New LIVE job: ${c.name}`, `/jobs/${c.id}`);
      reply.code(201);
      return i;
    });
  });

  app.get('/campaigns/:id/invitations', async (req) => {
    const { c } = await brandCampaign(pool, req, req.params.id);
    await expireStale(pool);
    return (await pool.query('SELECT i.*, sp.display_name FROM invitations i JOIN seller_profiles sp ON sp.user_id = i.seller_id WHERE i.campaign_id = $1 ORDER BY i.created_at', [c.id])).rows;
  });

  app.get('/seller/invitations', async (req) => {
    const u = user(req);
    await expireStale(pool);
    return (await pool.query(`SELECT i.*, c.name AS campaign, c.starts_at, c.ends_at FROM invitations i JOIN campaigns c ON c.id = i.campaign_id WHERE i.seller_id = $1 ORDER BY i.created_at DESC`, [u.id])).rows;
  });

  async function sellerInvitation(db, req) {
    const u = user(req);
    await expireStale(db);
    const i = await one(db, 'SELECT * FROM invitations WHERE id = $1 AND seller_id = $2 FOR UPDATE', [req.params.id, u.id], 'Invitation not found');
    return { u, i };
  }

  app.post('/invitations/:id/view', async (req) => {
    return tx(pool, async (db) => {
      const { i } = await sellerInvitation(db, req);
      if (i.status === 'invited') await db.query(`UPDATE invitations SET status = 'viewed' WHERE id = $1`, [i.id]);
      return { status: i.status === 'invited' ? 'viewed' : i.status };
    });
  });

  /** Once both sides have signed, the seller is booked: no other acceptance may void that contract. */
  async function assertNotBooked(db, campaignId) {
    const { rows } = await db.query('SELECT 1 FROM contracts WHERE campaign_id = $1 AND NOT void AND brand_signed_at IS NOT NULL AND seller_signed_at IS NOT NULL', [campaignId]);
    if (rows.length) throw conflict('A seller is already booked for this campaign', 'already_booked');
  }

  /** Accepting creates the contract from campaign terms + agreed invitation terms. */
  async function acceptInto(db, req, i, terms) {
    const c = await one(db, 'SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [i.campaign_id]);
    await assertNotBooked(db, c.id);
    const seller = await one(db, 'SELECT * FROM seller_profiles WHERE user_id = $1', [i.seller_id]);
    if (!seller.identity_verified || !seller.payout_verified) throw conflict('The seller must finish identity and payout setup before accepting a paid job', 'seller_not_verified');
    const { rows: missing } = await db.query(`SELECT rc FROM unnest($1::text[]) rc WHERE rc NOT IN (SELECT course FROM certificates WHERE user_id = $2 AND (expires_at IS NULL OR expires_at > now()))`, [c.required_courses, i.seller_id]);
    if (missing.length) throw conflict(`Required training missing: ${missing.map((r) => r.rc).join(', ')}`, 'training_missing');
    await db.query(`UPDATE invitations SET status = 'accepted', terms = $2 WHERE id = $1`, [i.id, terms]);
    await db.query(`UPDATE contracts SET void = true WHERE campaign_id = $1 AND NOT void`, [c.id]);
    const { rows: [{ v }] } = await db.query('SELECT COALESCE(max(version), 0) + 1 AS v FROM contracts WHERE campaign_id = $1', [c.id]);
    const contractTerms = {
      baseRateCents: terms.baseRateCents, commissionBps: c.commission_bps, bonusCents: c.bonus_cents, bonusGmvThresholdCents: c.bonus_gmv_threshold_cents,
      startsAt: c.starts_at, endsAt: c.ends_at, arrivalLeadMin: ARRIVAL_LEAD_MIN, paidBy: 'Creator Hub',
      eligibleSalesDefinition: 'Orders TikTok Shop attributes to the LIVE, minus refunds, cancellations and excluded orders, after the returns window',
      affiliateCommissionRule: 'If a TikTok Shop affiliate commission is paid on the same orders, it replaces this commission for those orders',
      cancellationPolicy: 'Seller: free until 72 h before; later lowers reliability; no-show 15 min after arrival time',
    };
    const { rows: [k] } = await db.query('INSERT INTO contracts (campaign_id, seller_id, version, terms) VALUES ($1, $2, $3, $4) RETURNING *', [c.id, i.seller_id, v, contractTerms]);
    await audit(db, req, 'invitation.accepted', 'invitation', i.id, { contractId: k.id });
    await notify(db, [...(await orgUsers(db, c.org_id, BRAND)), i.seller_id], 'contract', `Contract v${v} for ${c.name} is ready to sign`, `/contracts/${k.id}`);
    return { status: 'accepted', contract: k };
  }

  app.post('/invitations/:id/accept', async (req) => {
    return tx(pool, async (db) => {
      const { i } = await sellerInvitation(db, req);
      if (i.kind === 'application') throw conflict('The brand accepts applications');
      assertMove('invitation', i.status, 'accepted');
      return acceptInto(db, req, i, i.terms);
    });
  });

  app.post('/invitations/:id/decline', { schema: body({ reason: 'string' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { i } = await sellerInvitation(db, req);
      assertMove('invitation', i.status, 'declined');
      await db.query(`UPDATE invitations SET status = 'declined', decline_reason = $2 WHERE id = $1`, [i.id, req.body.reason]);
      const c = await one(db, 'SELECT org_id, name FROM campaigns WHERE id = $1', [i.campaign_id]);
      await notify(db, await orgUsers(db, c.org_id, BRAND), 'invitation', `A seller declined ${c.name}: ${req.body.reason}`);
      return { status: 'declined' };
    });
  });

  app.post('/invitations/:id/counter', { schema: body({ baseRateCents: { type: 'integer', minimum: 0 }, message: 'text?' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { i } = await sellerInvitation(db, req);
      assertMove('invitation', i.status, 'countered');
      await db.query(`UPDATE invitations SET status = 'countered', counter = $2 WHERE id = $1`, [i.id, { baseRateCents: req.body.baseRateCents, message: req.body.message ?? null }]);
      const c = await one(db, 'SELECT org_id, name FROM campaigns WHERE id = $1', [i.campaign_id]);
      await notify(db, await orgUsers(db, c.org_id, BRAND), 'invitation', `Counter-offer for ${c.name}`);
      return { status: 'countered' };
    });
  });

  async function brandInvitation(db, req) {
    const m = member(req, BRAND);
    await expireStale(db);
    const i = await one(db, `SELECT i.* FROM invitations i JOIN campaigns c ON c.id = i.campaign_id WHERE i.id = $1 AND c.org_id = $2 FOR UPDATE OF i`, [req.params.id, m.orgId], 'Invitation not found');
    return { m, i };
  }

  /** Brand answers a counter: accept it (→ contract) or send new terms back to the seller. */
  app.post('/invitations/:id/respond', { schema: body({ accept: 'boolean', baseRateCents: 'integer?' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { i } = await brandInvitation(db, req);
      if (i.status !== 'countered') throw conflict('There is no counter-offer to respond to');
      if (req.body.accept) return acceptInto(db, req, i, { baseRateCents: i.counter.baseRateCents });
      if (req.body.baseRateCents == null) throw bad('Send new terms (baseRateCents) or accept the counter');
      const exp = await setting(db, 'invite_expiry_hours');
      await db.query(`UPDATE invitations SET status = 'invited', terms = $2, counter = NULL, expires_at = now() + make_interval(hours => $3) WHERE id = $1`, [i.id, { baseRateCents: req.body.baseRateCents }, exp]);
      await notify(db, [i.seller_id], 'invitation', 'The brand sent new terms');
      return { status: 'invited' };
    });
  });

  app.post('/invitations/:id/accept-application', async (req) => {
    return tx(pool, async (db) => {
      const { i } = await brandInvitation(db, req);
      if (i.kind !== 'application') throw conflict('This is an invitation, not an application');
      assertMove('invitation', i.status, 'accepted');
      return acceptInto(db, req, i, i.terms);
    });
  });

  app.post('/invitations/:id/withdraw', async (req) => {
    return tx(pool, async (db) => {
      const { i } = await brandInvitation(db, req);
      assertMove('invitation', i.status, 'withdrawn');
      await db.query(`UPDATE invitations SET status = 'withdrawn' WHERE id = $1`, [i.id]);
      await notify(db, [i.seller_id], 'invitation', 'An invitation was withdrawn by the brand');
      return { status: 'withdrawn' };
    });
  });

  // ---------------------------------------------------------------- contracts
  async function contractFor(db, req, lock = false) {
    const u = user(req);
    const k = await one(db, `SELECT k.*, c.org_id, c.name AS campaign FROM contracts k JOIN campaigns c ON c.id = k.campaign_id WHERE k.id = $1${lock ? ' FOR UPDATE OF k' : ''}`, [req.params.id], 'Contract not found');
    const isSeller = k.seller_id === u.id;
    const isBrand = req.membership?.orgId === k.org_id;
    if (!isSeller && !isBrand) throw notFound('Contract not found');
    return { k, isSeller, isBrand };
  }

  app.get('/contracts/:id', async (req) => (await contractFor(pool, req)).k);

  app.post('/contracts/:id/sign', { schema: body({ typedName: 'string' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { k, isSeller, isBrand } = await contractFor(db, req, true);
      if (k.void) throw conflict('This contract version was replaced; sign the latest version');
      if (isBrand) {
        if (req.membership.role !== 'brand_owner') throw forbidden('Only a Brand Owner signs seller contracts in the MVP');
        if (k.brand_signed_at) throw conflict('Already signed by the brand');
        await db.query('UPDATE contracts SET brand_signed_by = $2, brand_signed_at = now() WHERE id = $1', [k.id, req.user.id]);
      } else if (isSeller) {
        if (k.seller_signed_at) throw conflict('Already signed by the seller');
        await db.query('UPDATE contracts SET seller_signed_at = now() WHERE id = $1', [k.id]);
      }
      await audit(db, req, 'contract.signed', 'contract', k.id, { by: isBrand ? 'brand' : 'seller', typedName: req.body.typedName, version: k.version });
      const { rows: [now] } = await db.query('SELECT * FROM contracts WHERE id = $1', [k.id]);
      if (now.brand_signed_at && now.seller_signed_at) {
        await expireStale(db);
        const { rows: [bk] } = await db.query(`SELECT id FROM bookings WHERE campaign_id = $1 AND status = 'hold' FOR UPDATE`, [k.campaign_id]);
        if (!bk) throw conflict('The studio hold expired. Choose a slot again (hold a booth), then the seller re-confirms.', 'hold_expired');
        // Exclusion constraint refuses this if the seller is already booked at an overlapping time.
        await db.query('UPDATE bookings SET seller_id = $2 WHERE id = $1', [bk.id, k.seller_id]);
        await db.query(`UPDATE invitations SET status = 'withdrawn' WHERE campaign_id = $1 AND seller_id <> $2 AND status IN ('invited', 'viewed', 'countered', 'applied')`, [k.campaign_id, k.seller_id]);
        await notify(db, [...(await orgUsers(db, k.org_id, BRAND)), k.seller_id], 'contract', `Contract for ${k.campaign} is signed by both. Waiting for studio confirmation.`);
      }
      return { brandSigned: Boolean(now.brand_signed_at), sellerSigned: Boolean(now.seller_signed_at) };
    });
  });

  // ---------------------------------------------------------------- campaign messages
  async function canMessage(db, req, campaignId) {
    const u = user(req);
    const c = await one(db, 'SELECT * FROM campaigns WHERE id = $1', [campaignId], 'Campaign not found');
    if (req.membership?.orgId === c.org_id) return c;
    const { rows } = await db.query('SELECT 1 FROM invitations WHERE campaign_id = $1 AND seller_id = $2', [campaignId, u.id]);
    if (rows.length) return c;
    const { rows: ops } = await db.query(`SELECT 1 FROM locations l WHERE l.id = $1 AND l.org_id = $2`, [c.location_id, req.membership?.orgId ?? null]);
    if (ops.length) return c;
    throw notFound('Campaign not found');
  }

  app.get('/campaigns/:id/messages', async (req) => {
    await canMessage(pool, req, req.params.id);
    return (await pool.query('SELECT m.*, u.name AS sender FROM messages m JOIN users u ON u.id = m.sender_id WHERE campaign_id = $1 ORDER BY created_at', [req.params.id])).rows;
  });

  app.post('/campaigns/:id/messages', { schema: body({ body: 'text' }) }, async (req, reply) => {
    await canMessage(pool, req, req.params.id);
    // Contact details are masked so contracting stays on the platform.
    const masked = req.body.body
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email hidden]')
      .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone hidden]');
    const { rows: [msg] } = await pool.query('INSERT INTO messages (campaign_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *', [req.params.id, req.user.id, masked]);
    reply.code(201);
    return msg;
  });
}
