// Studio operations: locations, booths, bookings, producers, equipment, shipments, samples, check-in, readiness,
// LIVE session, metrics, incidents, closeout, results import, control center (blueprint O01–O24, C13–C19, BF08–BF15).
import { setting, tx } from '../db.js';
import { audit, bad, body, conflict, forbidden, member, notify, notFound, one, orgUsers, user, BRAND, HttpError } from '../http.js';
import { adjustAfterLock, loadSettlement, recomputeProvisional } from '../settle.js';
import { provider, sandboxOrders } from '../providers.js';
import { assertMove } from '../status.js';
import { ARRIVAL_LEAD_MIN } from './catalog.js';

export const READINESS = [
  ['checked_in', 'Front desk'], ['briefing_acknowledged', 'Seller'], ['tiktok_logged_in', 'Seller (checked by producer)'], ['showcase_ready', 'Seller (checked by producer)'],
  ['camera_audio', 'Producer'], ['network', 'Producer'], ['samples_at_booth', 'Producer'], ['compliance', 'Producer'],
];
const FLOOR = ['location_manager', 'producer'];
const BOOKING_SQL = `SELECT b.*, bo.name AS booth, bo.location_id, l.org_id AS ops_org, l.no_show_min, l.checkin_open_min, l.sample_cutoff_hours,
    c.org_id AS brand_org, c.name AS campaign, c.status AS campaign_status FROM bookings b
  JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id JOIN campaigns c ON c.id = b.campaign_id WHERE b.id = $1`;
const arrival = (b) => new Date(new Date(b.starts_at).getTime() - ARRIVAL_LEAD_MIN * 60000);

async function opsBooking(db, req, id, roles) {
  const m = member(req, roles);
  if (m.kind !== 'operator') throw forbidden('Creator Hub staff only');
  const b = await one(db, `${BOOKING_SQL} FOR UPDATE OF b`, [id], 'Booking not found');
  if (b.ops_org !== m.orgId) throw notFound('Booking not found');
  return { m, b };
}
/** Brand of the campaign, the booked seller, or the operating studio may read a booking. */
async function anyBooking(db, req, id) {
  const b = await one(db, BOOKING_SQL, [id], 'Booking not found');
  if (req.user && (req.membership?.orgId === b.brand_org || req.membership?.orgId === b.ops_org || b.seller_id === req.user.id)) return b;
  throw notFound('Booking not found');
}
async function opsLocation(db, req, id, roles) {
  const m = member(req, roles);
  return one(db, 'SELECT * FROM locations WHERE id = $1 AND org_id = $2', [id, m.orgId], 'Location not found');
}

/** Minimal CSV: header row optional, comma-separated, no quoted commas (TikTok Shop export columns mapped by name or position). */
function parseCsv(text, columns) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw bad('The file is empty');
  const first = lines[0].split(',').map((s) => s.trim().toLowerCase());
  const hasHeader = columns.filter((c) => !c.endsWith('?')).every((c) => first.includes(c));
  const idx = hasHeader ? Object.fromEntries(columns.map((c) => [c.split('?')[0], first.indexOf(c.split('?')[0])])) : Object.fromEntries(columns.map((c, i) => [c.split('?')[0], i]));
  return lines.slice(hasHeader ? 1 : 0).map((line, n) => {
    const cells = line.split(',').map((s) => s.trim());
    const row = {};
    for (const c of columns) {
      const k = c.split('?')[0];
      const v = idx[k] >= 0 ? cells[idx[k]] : undefined;
      if ((v === undefined || v === '') && !c.endsWith('?')) throw bad(`Row ${n + 1 + (hasHeader ? 1 : 0)}: ${k} is missing`, 'import_error');
      row[k] = v;
    }
    return row;
  });
}

export default async function studio(app) {
  const { pool } = app;

  // ---------------------------------------------------------------- locations and booths
  app.post('/locations', { schema: body({ name: 'string', address: 'string?', timezone: 'string?', status: { enum: ['opening', 'open', 'closed'] } }) }, async (req, reply) => {
    const m = member(req, ['location_manager']);
    if (m.kind !== 'operator') throw forbidden('Creator Hub only');
    const { rows: [l] } = await pool.query('INSERT INTO locations (org_id, name, address, timezone, status) VALUES ($1, $2, COALESCE($3, \'\'), COALESCE($4, \'America/New_York\'), $5) RETURNING *', [m.orgId, req.body.name, req.body.address ?? null, req.body.timezone ?? null, req.body.status]);
    await audit(pool, req, 'location.created', 'location', l.id);
    reply.code(201);
    return l;
  });

  app.get('/locations', async (req) => {
    if (!req.user) throw forbidden();
    return (await pool.query(`SELECT * FROM locations WHERE status <> 'closed' ORDER BY name`)).rows;
  });

  app.patch('/locations/:id', { schema: body({ setupMin: 'integer?', teardownMin: 'integer?', holdHours: 'integer?', sampleCutoffHours: 'integer?', checkinOpenMin: 'integer?', noShowMin: 'integer?', status: 'string?', address: 'string?' }) }, async (req) => {
    const l = await opsLocation(pool, req, req.params.id, ['location_manager']);
    const b = req.body;
    const { rows: [u] } = await pool.query(
      `UPDATE locations SET setup_min = COALESCE($2, setup_min), teardown_min = COALESCE($3, teardown_min), hold_hours = COALESCE($4, hold_hours), sample_cutoff_hours = COALESCE($5, sample_cutoff_hours),
         checkin_open_min = COALESCE($6, checkin_open_min), no_show_min = COALESCE($7, no_show_min), status = COALESCE($8, status), address = COALESCE($9, address) WHERE id = $1 RETURNING *`,
      [l.id, b.setupMin ?? null, b.teardownMin ?? null, b.holdHours ?? null, b.sampleCutoffHours ?? null, b.checkinOpenMin ?? null, b.noShowMin ?? null, b.status ?? null, b.address ?? null]);
    await audit(pool, req, 'location.settings_changed', 'location', l.id, b);
    return u;
  });

  app.post('/locations/:id/booths', { schema: body({ name: 'string', type: 'string', categories: 'strings?' }) }, async (req, reply) => {
    const l = await opsLocation(pool, req, req.params.id, ['location_manager']);
    const { rows: [bo] } = await pool.query('INSERT INTO booths (location_id, name, type, categories) VALUES ($1, $2, $3, COALESCE($4::text[], \'{}\')) RETURNING *', [l.id, req.body.name, req.body.type, req.body.categories ?? null]);
    reply.code(201);
    return bo;
  });

  app.get('/locations/:id/booths', async (req) => {
    if (!req.user) throw forbidden();
    return (await pool.query('SELECT * FROM booths WHERE location_id = $1 ORDER BY name', [req.params.id])).rows;
  });

  app.patch('/booths/:id', { schema: body({ status: { enum: ['available', 'maintenance', 'retired'] } }) }, async (req) => {
    const m = member(req, ['location_manager']);
    return tx(pool, async (db) => {
      const bo = await one(db, 'SELECT bo.* FROM booths bo JOIN locations l ON l.id = bo.location_id WHERE bo.id = $1 AND l.org_id = $2 FOR UPDATE OF bo', [req.params.id, m.orgId], 'Booth not found');
      const { rows: future } = await db.query(`SELECT id FROM bookings WHERE booth_id = $1 AND status IN ('hold', 'confirmed') AND starts_at > now()`, [bo.id]);
      await db.query('UPDATE booths SET status = $2 WHERE id = $1', [bo.id, req.body.status]);
      await audit(db, req, 'booth.status_changed', 'booth', bo.id, { status: req.body.status });
      return { status: req.body.status, bookingsToReassign: req.body.status === 'available' ? [] : future.map((f) => f.id) };
    });
  });

  /** Brands see only busy/free per booth; Creator Hub staff see the bookings. */
  app.get('/locations/:id/availability', async (req) => {
    if (!req.user) throw forbidden();
    const from = req.query.from ?? new Date().toISOString();
    const to = req.query.to ?? new Date(Date.now() + 7 * 864e5).toISOString();
    const { rows: [own] } = await pool.query('SELECT org_id FROM locations WHERE id = $1', [req.params.id]);
    const isOps = req.membership?.kind === 'operator' && own?.org_id === req.membership.orgId;
    const { rows } = await pool.query(
      `SELECT bo.id AS booth_id, bo.name AS booth, bo.status AS booth_status,
         COALESCE(json_agg(json_build_object('from', lower(b.slot), 'to', upper(b.slot), 'status', b.status${isOps ? ", 'bookingId', b.id, 'campaign', c.name" : ''}) ORDER BY lower(b.slot)) FILTER (WHERE b.id IS NOT NULL), '[]') AS busy
       FROM booths bo LEFT JOIN bookings b ON b.booth_id = bo.id AND b.status IN ('hold', 'confirmed', 'checked_in', 'in_progress') AND b.slot && tstzrange($2, $3)
       LEFT JOIN campaigns c ON c.id = b.campaign_id
       WHERE bo.location_id = $1 GROUP BY bo.id ORDER BY bo.name`, [req.params.id, from, to]);
    return rows;
  });

  // ---------------------------------------------------------------- bookings (studio side)
  app.get('/bookings', async (req) => {
    const m = member(req, ['location_manager', 'producer', 'inventory', 'finance_admin']);
    const { rows } = await pool.query(
      `SELECT b.*, bo.name AS booth, c.name AS campaign, sp.display_name AS seller FROM bookings b JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id
       JOIN campaigns c ON c.id = b.campaign_id LEFT JOIN seller_profiles sp ON sp.user_id = b.seller_id
       WHERE l.org_id = $1 AND ($2::text IS NULL OR b.status = $2) AND ($3::uuid IS NULL OR b.producer_id = $3) ORDER BY b.starts_at`,
      [m.orgId, req.query.status ?? null, req.query.mine === 'true' ? req.user.id : null]);
    return rows;
  });

  app.get('/bookings/:id', async (req) => {
    const b = await anyBooking(pool, req, req.params.id);
    const { rows: readiness } = await pool.query('SELECT item, result, note, at FROM readiness WHERE booking_id = $1', [b.id]);
    const isSeller = b.seller_id === req.user.id;
    return { ...b, checkin_code: isSeller || req.membership?.orgId === b.ops_org ? b.checkin_code : undefined, arrival_at: arrival(b), readiness };
  });

  app.post('/bookings/:id/assign-producer', { schema: body({ producerId: 'uuid' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { m, b } = await opsBooking(db, req, req.params.id, ['location_manager']);
      await one(db, `SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2 AND role = 'producer'`, [m.orgId, req.body.producerId], 'That person is not a producer here');
      // Exclusion constraint refuses a producer who already has an overlapping session.
      await db.query('UPDATE bookings SET producer_id = $2 WHERE id = $1', [b.id, req.body.producerId]);
      await audit(db, req, 'booking.producer_assigned', 'booking', b.id, { producerId: req.body.producerId });
      await notify(db, [req.body.producerId], 'shift', `You produce ${b.campaign} at ${b.booth}`);
      return { ok: true };
    });
  });

  app.post('/bookings/:id/confirm', async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, ['location_manager']);
      if (b.status === 'hold' && b.hold_expires_at < new Date()) throw conflict('The hold expired; the brand must pick the slot again', 'hold_expired');
      assertMove('booking', b.status, 'confirmed');
      if (!b.seller_id) throw conflict('The contract isn’t signed by both sides yet', 'contract_unsigned');
      if (!b.producer_id) throw conflict('Assign a producer before confirming', 'no_producer');
      await db.query(`UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL WHERE id = $1`, [b.id]);
      for (const [item] of READINESS) await db.query('INSERT INTO readiness (booking_id, item) VALUES ($1, $2) ON CONFLICT DO NOTHING', [b.id, item]);
      const c = await one(db, 'SELECT status FROM campaigns WHERE id = $1 FOR UPDATE', [b.campaign_id]);
      assertMove('campaign', c.status, 'scheduled');
      await db.query(`UPDATE campaigns SET status = 'scheduled' WHERE id = $1`, [b.campaign_id]);
      await audit(db, req, 'booking.confirmed', 'booking', b.id);
      await notify(db, [...(await orgUsers(db, b.brand_org, BRAND)), b.seller_id, b.producer_id], 'booking', `${b.campaign} is confirmed at ${b.booth}`);
      return { status: 'confirmed' };
    });
  });

  // ---------------------------------------------------------------- moving and rescheduling
  /** Studio moves a booking to another of its booths at the same time (e.g. a booth goes into maintenance). */
  app.post('/bookings/:id/move', { schema: body({ boothId: 'uuid' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { m, b } = await opsBooking(db, req, req.params.id, ['location_manager']);
      if (!['hold', 'confirmed'].includes(b.status)) throw conflict('Only upcoming bookings can move');
      const to = await one(db, 'SELECT bo.*, l.setup_min, l.teardown_min FROM booths bo JOIN locations l ON l.id = bo.location_id WHERE bo.id = $1 AND l.org_id = $2', [req.body.boothId, m.orgId], 'Booth not found');
      if (to.id === b.booth_id) throw bad('That is the current booth');
      if (to.status !== 'available') throw conflict(`${to.name} is not available (${to.status})`);
      // The exclusion constraint refuses the move if the new booth is busy at that time (setup and teardown included).
      await db.query(`UPDATE bookings SET booth_id = $2, slot = tstzrange(starts_at - make_interval(mins => $3), ends_at + make_interval(mins => $4)) WHERE id = $1`, [b.id, to.id, to.setup_min, to.teardown_min]);
      await audit(db, req, 'booking.moved', 'booking', b.id, { from: b.booth_id, to: to.id });
      await notify(db, [...(await orgUsers(db, b.brand_org, BRAND)), b.seller_id, b.producer_id].filter(Boolean), 'booking', `${b.campaign} moved from ${b.booth} to ${to.name} (same time)`);
      return { booth: to.name };
    });
  });

  /**
   * Brand Owner moves a held slot to a new time before any contract carries the old one.
   * ponytail: confirmed sessions are cancelled and rebooked; a two-party reschedule request flow comes when brands need it.
   */
  app.post('/bookings/:id/reschedule', { schema: body({ startsAt: 'datetime', endsAt: 'datetime' }) }, async (req) => {
    return tx(pool, async (db) => {
      const m = member(req, ['brand_owner']);
      const b = await one(db, `${BOOKING_SQL} FOR UPDATE OF b`, [req.params.id], 'Booking not found');
      if (b.brand_org !== m.orgId) throw notFound('Booking not found');
      if (b.status !== 'hold' || b.hold_expires_at < new Date()) throw conflict('Only an active hold can be rescheduled. For a confirmed session, cancel and book again.', 'not_hold');
      const start = new Date(req.body.startsAt);
      const end = new Date(req.body.endsAt);
      if (!(end > start) || start <= new Date()) throw bad('Choose a future start and an end after it');
      const { rows: live } = await db.query('SELECT 1 FROM contracts WHERE campaign_id = $1 AND NOT void', [b.campaign_id]);
      if (live.length) throw conflict('A contract already states the current time. Reschedule before a seller accepts, or cancel and rebook.', 'contract_exists');
      const loc = await one(db, 'SELECT l.setup_min, l.teardown_min FROM booths bo JOIN locations l ON l.id = bo.location_id WHERE bo.id = $1', [b.booth_id]);
      await db.query(`UPDATE bookings SET starts_at = $2, ends_at = $3, slot = tstzrange($2::timestamptz - make_interval(mins => $4), $3::timestamptz + make_interval(mins => $5)) WHERE id = $1`, [b.id, start, end, loc.setup_min, loc.teardown_min]);
      await db.query('UPDATE campaigns SET starts_at = $2, ends_at = $3 WHERE id = $1', [b.campaign_id, start, end]);
      await audit(db, req, 'booking.rescheduled', 'booking', b.id, { from: [b.starts_at, b.ends_at], to: [start, end] });
      const { rows: invited } = await db.query(`SELECT seller_id FROM invitations WHERE campaign_id = $1 AND status IN ('invited', 'viewed', 'countered', 'applied')`, [b.campaign_id]);
      await notify(db, invited.map((i) => i.seller_id), 'invitation', `${b.campaign} moved to ${start.toISOString()}`);
      return { startsAt: start, endsAt: end };
    });
  });

  /** The seller's own sessions, with the check-in code they show at the front desk. */
  app.get('/seller/bookings', async (req) => {
    const u = user(req);
    const { rows } = await pool.query(
      `SELECT b.id, b.status, b.starts_at, b.ends_at, b.checkin_code, bo.name AS booth, l.name AS location, l.address, c.id AS campaign_id, c.name AS campaign, o.name AS brand, pu.name AS producer,
         (SELECT result FROM readiness r WHERE r.booking_id = b.id AND r.item = 'briefing_acknowledged') AS briefing,
         (SELECT COALESCE(json_agg(json_build_object('name', p.name, 'sellingPoints', p.selling_points, 'restrictedClaims', p.restricted_claims)), '[]') FROM products p WHERE p.id = ANY(c.product_ids)) AS products
       FROM bookings b JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id JOIN campaigns c ON c.id = b.campaign_id JOIN orgs o ON o.id = c.org_id
       LEFT JOIN users pu ON pu.id = b.producer_id WHERE b.seller_id = $1 ORDER BY b.starts_at DESC`, [u.id]);
    return rows.map((r) => ({ ...r, arrival_at: arrival(r) }));
  });

  // ---------------------------------------------------------------- shipments and samples
  app.post('/bookings/:id/shipments', { schema: body({ productId: 'uuid', expectedQty: { type: 'integer', minimum: 1 }, tracking: 'string?' }) }, async (req, reply) => {
    const m = member(req, BRAND);
    return tx(pool, async (db) => {
      const b = await anyBooking(db, req, req.params.id);
      if (b.brand_org !== m.orgId) throw notFound('Booking not found');
      await one(db, 'SELECT 1 FROM products WHERE id = $1 AND org_id = $2', [req.body.productId, m.orgId], 'Product not found');
      const { rows: [s] } = await db.query('INSERT INTO shipments (booking_id, product_id, expected_qty, tracking) VALUES ($1, $2, $3, $4) RETURNING *', [b.id, req.body.productId, req.body.expectedQty, req.body.tracking ?? null]);
      reply.code(201);
      return s;
    });
  });

  app.get('/bookings/:id/shipments', async (req) => {
    const b = await anyBooking(pool, req, req.params.id);
    const cutoff = new Date(new Date(b.starts_at).getTime() - b.sample_cutoff_hours * 3.6e6);
    const { rows } = await pool.query('SELECT s.*, p.name AS product FROM shipments s JOIN products p ON p.id = s.product_id WHERE booking_id = $1', [b.id]);
    return rows.map((s) => ({ ...s, overdue: s.status === 'expected' && new Date() > cutoff, cutoff }));
  });

  app.post('/shipments/:id/receive', { schema: body({ receivedQty: { type: 'integer', minimum: 0 }, condition: { enum: ['good', 'damaged', 'opened'] }, shelf: 'string' }) }, async (req) => {
    const m = member(req, ['inventory', 'location_manager']);
    return tx(pool, async (db) => {
      const s = await one(db, `SELECT s.*, c.org_id AS brand_org, c.name AS campaign FROM shipments s JOIN bookings b ON b.id = s.booking_id JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id JOIN campaigns c ON c.id = b.campaign_id
        WHERE s.id = $1 AND l.org_id = $2 FOR UPDATE OF s`, [req.params.id, m.orgId], 'Shipment not found');
      if (s.status !== 'expected') throw conflict('This shipment was already received');
      const status = req.body.receivedQty >= s.expected_qty && req.body.condition === 'good' ? 'received' : 'short';
      await db.query('UPDATE shipments SET received_qty = $2, condition = $3, shelf = $4, status = $5, received_at = now() WHERE id = $1', [s.id, req.body.receivedQty, req.body.condition, req.body.shelf, status]);
      if (req.body.receivedQty > 0) await db.query(`INSERT INTO sample_movements (booking_id, kind, qty, to_place, by_user) VALUES ($1, 'received', $2, $3, $4)`, [s.booking_id, req.body.receivedQty, req.body.shelf, req.user.id]);
      await audit(db, req, `shipment.${status}`, 'shipment', s.id, req.body);
      await notify(db, await orgUsers(db, s.brand_org, BRAND), 'samples', status === 'received' ? `Samples for ${s.campaign} received` : `Samples for ${s.campaign}: received ${req.body.receivedQty} of ${s.expected_qty} (${req.body.condition}). Please resend.`);
      return { status };
    });
  });

  app.post('/bookings/:id/samples', { schema: body({ kind: { enum: ['used', 'returned', 'disposed', 'moved'] }, qty: { type: 'integer', minimum: 1 }, from: 'string?', to: 'string?' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, ['inventory', 'producer', 'location_manager']);
      await db.query('INSERT INTO sample_movements (booking_id, kind, qty, from_place, to_place, by_user) VALUES ($1, $2, $3, $4, $5, $6)', [b.id, req.body.kind, req.body.qty, req.body.from ?? null, req.body.to ?? null, req.user.id]);
      reply.code(201);
      return { ok: true };
    });
  });

  app.get('/bookings/:id/samples', async (req) => {
    const b = await anyBooking(pool, req, req.params.id);
    const { rows } = await pool.query('SELECT * FROM sample_movements WHERE booking_id = $1 ORDER BY at', [b.id]);
    const sum = (k) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.qty, 0);
    const balance = sum('received') - sum('used') - sum('returned') - sum('disposed');
    return { movements: rows, received: sum('received'), used: sum('used'), returned: sum('returned'), disposed: sum('disposed'), onHand: balance, discrepancy: b.status === 'completed' && balance !== 0 };
  });

  // ---------------------------------------------------------------- equipment
  app.post('/locations/:id/equipment', { schema: body({ code: 'string', type: 'string', boothId: 'uuid?' }) }, async (req, reply) => {
    const l = await opsLocation(pool, req, req.params.id, ['location_manager', 'producer']);
    const { rows: [e] } = await pool.query('INSERT INTO equipment (location_id, code, type, booth_id) VALUES ($1, $2, $3, $4) RETURNING *', [l.id, req.body.code, req.body.type, req.body.boothId ?? null]);
    reply.code(201);
    return e;
  });
  app.get('/locations/:id/equipment', async (req) => {
    const l = await opsLocation(pool, req, req.params.id, ['location_manager', 'producer']);
    return (await pool.query('SELECT * FROM equipment WHERE location_id = $1 ORDER BY code', [l.id])).rows;
  });
  app.patch('/equipment/:id', { schema: body({ status: { enum: ['ok', 'needs_check', 'repair', 'retired'] }, boothId: 'uuid?' }) }, async (req) => {
    const m = member(req, ['location_manager', 'producer']);
    const { rows: [e] } = await pool.query(`UPDATE equipment e SET status = $3, booth_id = COALESCE($4, e.booth_id) FROM locations l WHERE e.id = $1 AND l.id = e.location_id AND l.org_id = $2 RETURNING e.*`, [req.params.id, m.orgId, req.body.status, req.body.boothId ?? null]);
    if (!e) throw notFound('Equipment not found');
    await audit(pool, req, 'equipment.status', 'equipment', e.id, req.body);
    return e;
  });

  // ---------------------------------------------------------------- check-in, no-show
  app.post('/bookings/:id/check-in', { schema: body({ code: 'string' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, FLOOR);
      if (req.body.code.trim().toUpperCase() !== b.checkin_code) throw bad('Code doesn’t match this booking', 'wrong_code');
      const now = new Date();
      const opens = new Date(arrival(b).getTime() - b.checkin_open_min * 60000);
      if (now < opens) throw conflict(`Check-in opens at ${opens.toISOString()}`, 'too_early');
      assertMove('booking', b.status, 'checked_in');
      await db.query(`UPDATE bookings SET status = 'checked_in', checked_in_at = now() WHERE id = $1`, [b.id]);
      await db.query(`UPDATE readiness SET result = 'pass', by_user = $2, at = now() WHERE booking_id = $1 AND item = 'checked_in'`, [b.id, req.user.id]);
      const c = await one(db, 'SELECT status FROM campaigns WHERE id = $1 FOR UPDATE', [b.campaign_id]);
      assertMove('campaign', c.status, 'in_progress');
      await db.query(`UPDATE campaigns SET status = 'in_progress' WHERE id = $1`, [b.campaign_id]);
      await audit(db, req, 'booking.checked_in', 'booking', b.id);
      await notify(db, [b.producer_id], 'checkin', `Seller checked in for ${b.campaign}`);
      return { status: 'checked_in', late: now > arrival(b) };
    });
  });

  app.post('/bookings/:id/no-show', async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, ['location_manager']);
      if (new Date() < new Date(arrival(b).getTime() + b.no_show_min * 60000)) throw conflict(`Too early: a no-show counts ${b.no_show_min} minutes after the arrival time`, 'too_early');
      assertMove('booking', b.status, 'no_show');
      await db.query(`UPDATE bookings SET status = 'no_show' WHERE id = $1`, [b.id]);
      const { rows: [sp] } = await db.query('UPDATE seller_profiles SET no_shows = no_shows + 1, paused = (no_shows + 1 >= 2) WHERE user_id = $1 RETURNING no_shows, paused', [b.seller_id]);
      await db.query(`UPDATE campaigns SET status = 'recruiting' WHERE id = $1 AND status = 'scheduled'`, [b.campaign_id]);
      await audit(db, req, 'booking.no_show', 'booking', b.id, sp);
      await notify(db, [...(await orgUsers(db, b.brand_org, BRAND)), b.seller_id], 'booking', `No-show recorded for ${b.campaign}. Choose a backup seller or reschedule.`);
      return { status: 'no_show', sellerPaused: sp.paused };
    });
  });

  // ---------------------------------------------------------------- readiness, go, start
  app.get('/bookings/:id/readiness', async (req) => {
    const b = await anyBooking(pool, req, req.params.id);
    const { rows } = await pool.query('SELECT * FROM readiness WHERE booking_id = $1', [b.id]);
    return READINESS.map(([item, owner]) => ({ item, owner, ...(rows.find((r) => r.item === item) ?? { result: 'pending' }) }));
  });

  app.post('/bookings/:id/briefing/acknowledge', async (req) => {
    return tx(pool, async (db) => {
      const b = await one(db, 'SELECT * FROM bookings WHERE id = $1 AND seller_id = $2 FOR UPDATE', [req.params.id, req.user?.id ?? null], 'Booking not found');
      await db.query(`UPDATE readiness SET result = 'pass', by_user = $2, at = now() WHERE booking_id = $1 AND item = 'briefing_acknowledged'`, [b.id, req.user.id]);
      await audit(db, req, 'briefing.acknowledged', 'booking', b.id);
      return { ok: true };
    });
  });

  app.post('/bookings/:id/readiness/:item', { schema: body({ result: { enum: ['pass', 'fail'] }, note: 'text?' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, FLOOR);
      if (!READINESS.some(([i]) => i === req.params.item) || ['checked_in', 'briefing_acknowledged'].includes(req.params.item)) throw bad('Unknown or seller-owned checklist item');
      await db.query('UPDATE readiness SET result = $3, note = $4, by_user = $5, at = now() WHERE booking_id = $1 AND item = $2', [b.id, req.params.item, req.body.result, req.body.note ?? null, req.user.id]);
      if (req.body.result === 'fail') await notify(db, await orgUsers(db, b.ops_org, ['location_manager']), 'readiness', `${b.campaign}: ${req.params.item} failed${req.body.note ? ` (${req.body.note})` : ''}`);
      return { ok: true };
    });
  });

  app.post('/bookings/:id/go', { schema: body({ overrideReason: 'text?' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { m, b } = await opsBooking(db, req, req.params.id, FLOOR);
      if (b.status !== 'checked_in') throw conflict('The seller must be checked in first');
      const { rows: notPassed } = await db.query(`SELECT item FROM readiness WHERE booking_id = $1 AND result <> 'pass'`, [b.id]);
      if (notPassed.length && !(req.body.overrideReason && m.role === 'location_manager')) throw conflict(`Not ready: ${notPassed.map((r) => r.item).join(', ')}. A location manager can override with a reason.`, 'not_ready');
      await db.query('UPDATE bookings SET go_at = now(), go_override_reason = $2 WHERE id = $1', [b.id, notPassed.length ? req.body.overrideReason : null]);
      await audit(db, req, notPassed.length ? 'readiness.override' : 'readiness.go', 'booking', b.id, { notPassed: notPassed.map((r) => r.item), reason: req.body.overrideReason });
      await notify(db, [b.seller_id], 'go', 'Producer says: go LIVE when cued. Start the LIVE in the TikTok app.');
      return { go: true };
    });
  });

  app.post('/bookings/:id/start', async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, FLOOR);
      if (!b.go_at) throw conflict('Give the Go first (readiness)');
      assertMove('booking', b.status, 'in_progress');
      await db.query(`UPDATE bookings SET status = 'in_progress', actual_start = now() WHERE id = $1`, [b.id]);
      await audit(db, req, 'live.started', 'booking', b.id);
      return { status: 'in_progress' };
    });
  });

  // ---------------------------------------------------------------- LIVE: metrics, incidents
  app.post('/bookings/:id/metrics', { schema: body({ orders: { type: 'integer', minimum: 0 }, gmvCents: { type: 'integer', minimum: 0 }, asOf: 'datetime' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, FLOOR);
      if (b.status !== 'in_progress') throw conflict('Metrics are entered during the LIVE');
      const { rows: [e] } = await db.query('INSERT INTO metric_entries (booking_id, orders, gmv_cents, as_of, by_user) VALUES ($1, $2, $3, $4, $5) RETURNING *', [b.id, req.body.orders, req.body.gmvCents, req.body.asOf, req.user.id]);
      reply.code(201);
      return { ...e, source: 'Manual' };
    });
  });

  app.post('/bookings/:id/incidents', { schema: body({ category: { enum: ['technical', 'connection', 'compliance', 'seller', 'safety', 'platform'] }, severity: { enum: ['high', 'medium', 'low'] }, description: 'text', emergencyStop: 'boolean?' }) }, async (req, reply) => {
    return tx(pool, async (db) => {
      const { m, b } = await opsBooking(db, req, req.params.id, ['location_manager', 'producer', 'inventory']);
      if (req.body.emergencyStop && !FLOOR.includes(m.role)) throw forbidden('Only a producer or location manager can request an emergency stop');
      const { rows: [i] } = await db.query('INSERT INTO incidents (booking_id, category, severity, description, emergency_stop, opened_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [b.id, req.body.category, req.body.severity, req.body.description, Boolean(req.body.emergencyStop), req.user.id]);
      await audit(db, req, req.body.emergencyStop ? 'live.emergency_stop_requested' : 'incident.opened', 'incident', i.id, req.body);
      const who = [...(await orgUsers(db, b.ops_org, ['location_manager'])), b.producer_id];
      if (req.body.severity === 'high' || req.body.emergencyStop) who.push(...(await orgUsers(db, b.brand_org, BRAND)));
      if (req.body.emergencyStop) who.push(b.seller_id);
      // Vyralink can't end a TikTok stream; the producer instructs the seller to end it in the TikTok app.
      await notify(db, who, 'incident', req.body.emergencyStop ? `Emergency stop for ${b.campaign}: end the LIVE in the TikTok app now. Reason: ${req.body.description}` : `${req.body.severity} incident on ${b.campaign}: ${req.body.description}`);
      reply.code(201);
      return i;
    });
  });

  app.get('/incidents', async (req) => {
    const m = member(req, ['location_manager', 'producer', 'inventory', 'finance_admin']);
    return (await pool.query(`SELECT i.*, c.name AS campaign FROM incidents i JOIN bookings b ON b.id = i.booking_id JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id JOIN campaigns c ON c.id = b.campaign_id
      WHERE l.org_id = $1 AND ($2::text IS NULL OR i.status = $2) ORDER BY CASE i.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, i.opened_at`, [m.orgId, req.query.status ?? null])).rows;
  });

  app.patch('/incidents/:id', { schema: body({ status: { enum: ['open', 'monitoring', 'resolved'] }, minutesLost: 'integer?', resolution: 'text?' }) }, async (req) => {
    const m = member(req, FLOOR);
    return tx(pool, async (db) => {
      const i = await one(db, `SELECT i.* FROM incidents i JOIN bookings b ON b.id = i.booking_id JOIN booths bo ON bo.id = b.booth_id JOIN locations l ON l.id = bo.location_id WHERE i.id = $1 AND l.org_id = $2 FOR UPDATE OF i`, [req.params.id, m.orgId], 'Incident not found');
      if (req.body.status === 'resolved' && !req.body.resolution) throw bad('Describe how it was resolved');
      const { rows: [u] } = await db.query(`UPDATE incidents SET status = $2, minutes_lost = COALESCE($3, minutes_lost), resolution = COALESCE($4, resolution), resolved_at = CASE WHEN $2 = 'resolved' THEN now() END WHERE id = $1 RETURNING *`, [i.id, req.body.status, req.body.minutesLost ?? null, req.body.resolution ?? null]);
      await audit(db, req, `incident.${req.body.status}`, 'incident', i.id, req.body);
      return u;
    });
  });

  // ---------------------------------------------------------------- closeout and results
  app.post('/bookings/:id/closeout', { schema: body({ actualEnd: 'datetime?', partial: 'boolean?', notes: 'text?' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, FLOOR);
      assertMove('booking', b.status, 'completed');
      const { rows: [{ lost }] } = await db.query('SELECT COALESCE(sum(minutes_lost), 0)::int AS lost FROM incidents WHERE booking_id = $1', [b.id]);
      const days = await setting(db, 'returns_window_days');
      await db.query(`UPDATE bookings SET status = 'completed', actual_end = COALESCE($2::timestamptz, now()), minutes_lost = $3, partial = COALESCE($4, false), returns_window_ends_at = now() + make_interval(days => $5) WHERE id = $1`,
        [b.id, req.body.actualEnd ?? null, lost, req.body.partial ?? null, days]);
      const { b: done, terms, liveMinutes, s } = await loadSettlement(db, b.id);
      await db.query(`INSERT INTO ledger_entries (seller_id, booking_id, kind, basis, amount_cents, status) VALUES ($1, $2, 'base', $3, $4, 'locked')`,
        [done.seller_id, b.id, `$${(terms.base_rate_cents / 100).toFixed(2)} / h × ${Math.floor(liveMinutes / 60)} h ${liveMinutes % 60} min (studio log${lost ? `, ${lost} min lost` : ''})`, s.basePayCents]);
      const due = await setting(db, 'invoice_due_days');
      await db.query(`INSERT INTO invoices (number, org_id, campaign_id, booking_id, kind, basis, amount_cents, status, issued_at, due_at) VALUES ('INV-' || nextval('invoice_number_seq'), $1, $2, $3, 'production', 'Per-session package', $4, 'issued', now(), now() + make_interval(days => $5))
        ON CONFLICT (booking_id, kind) WHERE kind IN ('production', 'performance') DO NOTHING`, [done.brand_org, done.campaign_id, b.id, terms.production_fee_cents, due]);
      await audit(db, req, 'live.closed_out', 'booking', b.id, { liveMinutes, minutesLost: lost, partial: Boolean(req.body.partial), notes: req.body.notes });
      await notify(db, await orgUsers(db, done.brand_org, BRAND), 'session', `${b.campaign} finished. Results usually arrive within a day.`);
      return { status: 'completed', liveMinutes, basePayCents: s.basePayCents, resultsStatus: 'pending' };
    });
  });

  /** TikTok Shop order report (CSV): order_id, placed_at, amount_cents, status[, attributed]. Producer entries are never used here. */
  app.post('/bookings/:id/results', { schema: body({ csv: 'text' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, ['producer', 'location_manager', 'finance_admin']);
      if (b.status !== 'completed') throw conflict('Close out the session before importing results');
      if (b.results_status === 'locked') throw conflict('Results are locked; import refunds instead');
      return importOrders(db, req, b, parseCsv(req.body.csv, ['order_id', 'placed_at', 'amount_cents', 'status', 'attributed?']), 'csv');
    });
  });

  /** Shared by the CSV import and provider sync: validates every row, upserts, recomputes provisional pay. */
  async function importOrders(db, req, b, rows, source) {
      for (const [n, r] of rows.entries()) {
        const amount = Number(r.amount_cents);
        if (!Number.isInteger(amount) || amount < 0) throw bad(`Row ${n + 1}: amount_cents must be a whole number of cents`, 'import_error');
        if (!['completed', 'cancelled', 'refunded'].includes(r.status)) throw bad(`Row ${n + 1}: status must be completed, cancelled or refunded`, 'import_error');
        if (Number.isNaN(Date.parse(r.placed_at))) throw bad(`Row ${n + 1}: placed_at is not a date`, 'import_error');
        const attributed = r.attributed === undefined ? true : !['false', '0', 'no'].includes(r.attributed.toLowerCase());
        await db.query(`INSERT INTO session_orders (booking_id, order_id, placed_at, amount_cents, status, attributed, excluded_reason, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (booking_id, order_id) DO UPDATE SET placed_at = EXCLUDED.placed_at, amount_cents = EXCLUDED.amount_cents, status = EXCLUDED.status, attributed = EXCLUDED.attributed, excluded_reason = EXCLUDED.excluded_reason, source = EXCLUDED.source`,
          [b.id, r.order_id, r.placed_at, amount, r.status, attributed, attributed ? null : 'Not attributed to the LIVE in the TikTok Shop report', source]);
      }
      await db.query(`UPDATE bookings SET results_status = 'imported' WHERE id = $1`, [b.id]);
      const s = await recomputeProvisional(db, b.id);
      await audit(db, req, 'results.imported', 'booking', b.id, { rows: rows.length, source });
      await notify(db, [...(await orgUsers(db, b.brand_org, BRAND)), b.seller_id], 'results', `Results ${source === 'sandbox' ? '(sandbox demo data) ' : ''}imported for ${b.campaign}`);
      return { imported: rows.length, source, settlement: s };
  }

  /** Pulls the order report from the configured orders provider (sandbox in development; TikTok Shop once approved). */
  app.post('/bookings/:id/results/sync', async (req) => {
    return tx(pool, async (db) => {
      const { b } = await opsBooking(db, req, req.params.id, ['producer', 'location_manager', 'finance_admin']);
      const p = provider('orders');
      if (p === 'csv') throw conflict('No orders integration is enabled; import the TikTok Shop CSV instead', 'provider_not_enabled');
      if (p === 'tiktok_shop') throw new HttpError(503, 'TikTok Shop partner access isn’t approved yet; import the CSV instead', 'not_configured');
      if (process.env.NODE_ENV === 'production') throw conflict('Sandbox orders are for development and test only', 'sandbox_in_production');
      if (b.status !== 'completed') throw conflict('Close out the session before importing results');
      if (b.results_status === 'locked') throw conflict('Results are locked; import refunds instead');
      const { rows: prices } = await db.query('SELECT p.price_cents FROM campaigns c JOIN products p ON p.id = ANY(c.product_ids) WHERE c.id = $1', [b.campaign_id]);
      return importOrders(db, req, b, sandboxOrders(b.id, b.actual_start ?? b.starts_at, prices.map((r) => r.price_cents)), 'sandbox');
    });
  });

  /** Refunds report (CSV): order_id, refund_cents. Before lock it updates provisional figures; after lock it creates adjustments and credit notes. */
  app.post('/bookings/:id/refunds', { schema: body({ csv: 'text' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { m, b } = await opsBooking(db, req, req.params.id, ['producer', 'location_manager', 'finance_admin']);
      if (b.results_status === 'pending') throw conflict('Import the order report first');
      const locked = b.results_status === 'locked';
      // Locked results move money: only finance (MFA) imports refunds then, and a refund can only grow.
      if (locked && m.role !== 'finance_admin') throw forbidden('After results are locked, only finance can import refunds');
      const rows = parseCsv(req.body.csv, ['order_id', 'refund_cents']);
      for (const [n, r] of rows.entries()) {
        const refund = Number(r.refund_cents);
        if (!Number.isInteger(refund) || refund < 0) throw bad(`Row ${n + 1}: refund_cents must be a whole number of cents`, 'import_error');
        await one(db, 'SELECT 1 FROM session_orders WHERE booking_id = $1 AND order_id = $2 FOR UPDATE', [b.id, r.order_id], `Row ${n + 1}: order ${r.order_id} is not in this session’s report`);
        await db.query(`UPDATE session_orders SET refund_cents = CASE WHEN $4 THEN GREATEST(refund_cents, LEAST($3, amount_cents)) ELSE LEAST($3, amount_cents) END,
          status = CASE WHEN GREATEST($3, CASE WHEN $4 THEN refund_cents ELSE 0 END) >= amount_cents THEN 'refunded' ELSE status END WHERE booking_id = $1 AND order_id = $2`, [b.id, r.order_id, refund, locked]);
      }
      const after = b.results_status === 'locked' ? await adjustAfterLock(db, b.id, req.user.id) : (await recomputeProvisional(db, b.id), []);
      await audit(db, req, 'refunds.imported', 'booking', b.id, { rows: rows.length, afterLock: after });
      if (b.seller_id) await notify(db, [b.seller_id], 'earnings', `Refunds updated your pay for ${b.campaign}`);
      return { imported: rows.length, adjustments: after };
    });
  });

  app.get('/bookings/:id/settlement', async (req) => {
    const b = await anyBooking(pool, req, req.params.id);
    const { terms, liveMinutes, s } = await loadSettlement(pool, b.id);
    const { rows: [{ sandbox }] } = await pool.query(`SELECT COALESCE(bool_or(source = 'sandbox'), false) AS sandbox FROM session_orders WHERE booking_id = $1`, [b.id]);
    // Sellers see their own terms and pay, never the brand's fees.
    const isSeller = b.seller_id === req.user.id && req.membership?.orgId !== b.brand_org && req.membership?.orgId !== b.ops_org;
    const { performanceFeeCents, productionFeeCents, ...pay } = s;
    const { performance_fee_bps, production_fee_cents, ...sellerTerms } = terms;
    return {
      resultsStatus: b.results_status, returnsWindowEndsAt: b.returns_window_ends_at, liveMinutes,
      terms: isSeller ? sellerTerms : terms,
      ...pay, ...(isSeller ? {} : { performanceFeeCents, productionFeeCents }),
      gmvPerHourCents: liveMinutes ? Math.round((s.gmvCents * 60) / liveMinutes) : null,
      sources: { orders: b.results_status === 'pending' ? 'Delayed' : sandbox ? 'Sandbox (demo data)' : 'Imported', liveHours: 'Verified (studio log)', viewers: 'Unavailable', conversion: 'Unavailable' },
    };
  });

  // ---------------------------------------------------------------- dashboards
  /** Control-center payload for one location: today's sessions, most urgent first, each figure with its source. */
  async function controlCenter(l) {
    const { rows } = await pool.query(
      `SELECT b.id, b.status, b.starts_at, b.ends_at, b.actual_start, b.go_at, bo.name AS booth, c.name AS campaign, o.name AS brand, sp.display_name AS host, pu.name AS producer,
         (SELECT row_to_json(m) FROM (SELECT orders, gmv_cents, as_of FROM metric_entries WHERE booking_id = b.id ORDER BY as_of DESC LIMIT 1) m) AS last_metric,
         (SELECT count(*) FROM readiness r WHERE r.booking_id = b.id AND r.result = 'pass')::int AS readiness_passed,
         (SELECT COALESCE(json_agg(json_build_object('id', i.id, 'severity', i.severity, 'description', i.description, 'status', i.status)), '[]') FROM incidents i WHERE i.booking_id = b.id AND i.status <> 'resolved') AS open_incidents
       FROM bookings b JOIN booths bo ON bo.id = b.booth_id JOIN campaigns c ON c.id = b.campaign_id JOIN orgs o ON o.id = c.org_id
       LEFT JOIN seller_profiles sp ON sp.user_id = b.seller_id LEFT JOIN users pu ON pu.id = b.producer_id
       WHERE bo.location_id = $1 AND b.status IN ('confirmed', 'checked_in', 'in_progress') AND b.starts_at::date <= (now() + interval '1 day')::date
       ORDER BY b.starts_at`, [l.id]);
    const sev = (r) => (r.open_incidents.some((i) => i.severity === 'high') ? 0 : r.status === 'checked_in' && r.readiness_passed < READINESS.length ? 1 : r.open_incidents.length ? 2 : 3);
    return {
      note: 'Vyralink does not control TikTok streams. Start, end and in-stream actions happen in TikTok on the studio device.',
      sessions: rows.sort((a, b) => sev(a) - sev(b)).map((r) => {
        const hours = r.actual_start ? (Date.now() - new Date(r.actual_start).getTime()) / 3.6e6 : 0;
        return {
          ...r, readiness: `${r.readiness_passed} / ${READINESS.length}`,
          connection: { value: null, source: 'Unavailable' }, viewers: { value: null, source: 'Unavailable' },
          orders: r.last_metric ? { value: r.last_metric.orders, source: 'Manual', asOf: r.last_metric.as_of } : { value: null, source: 'Unavailable' },
          gmvCents: r.last_metric ? { value: r.last_metric.gmv_cents, source: 'Manual', asOf: r.last_metric.as_of } : { value: null, source: 'Delayed' },
          gmvPerHourCents: r.last_metric && hours > 0 ? { value: Math.round(r.last_metric.gmv_cents / hours), source: 'Manual' } : { value: null, source: 'Unavailable' },
        };
      }),
    };
  }

  app.get('/locations/:id/control-center', async (req) => controlCenter(await opsLocation(pool, req, req.params.id, ['location_manager', 'producer'])));

  /**
   * Server-sent events: the same payload, pushed whenever the location changes (Postgres NOTIFY), and every 30 s for
   * time-based figures. Session, lock and role are re-checked on each tick, so a revoked session or removed member stops receiving.
   */
  // Open streams, per session and per process: each stream is cheap, but not free.
  const STREAMS_PER_SESSION = 3;
  const STREAMS_PER_PROCESS = 500;
  const streams = new Map(); // session id -> open count
  let openStreams = 0;
  // One board computation per location per burst of changes, shared by every subscriber of that location.
  const boards = new Map();
  const sharedBoard = (l) => {
    if (!boards.has(l.id)) boards.set(l.id, controlCenter(l).finally(() => setTimeout(() => boards.delete(l.id), 250)));
    return boards.get(l.id);
  };

  /**
   * Server-sent events: the same payload, pushed whenever the location changes (Postgres NOTIFY), and every 30 s for
   * time-based figures. Before every push the session, account lock and floor role are re-checked (cached 5 s), so a
   * revoked session or removed member stops receiving within seconds.
   */
  app.get('/locations/:id/control-center/stream', async (req, reply) => {
    const l = await opsLocation(pool, req, req.params.id, ['location_manager', 'producer']);
    const sessionId = req.session.id;
    if ((streams.get(sessionId) ?? 0) >= STREAMS_PER_SESSION) throw new HttpError(429, 'Too many open control-center tabs; close one and try again', 'too_many_streams');
    if (openStreams >= STREAMS_PER_PROCESS) throw new HttpError(503, 'The live board is busy; try again shortly', 'stream_capacity');
    streams.set(sessionId, (streams.get(sessionId) ?? 0) + 1);
    openStreams += 1;

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    let closed = false;
    let timer = null;
    let tick = null;
    let unsubscribe = () => {};
    let checkedAt = 0;

    const allowed = async () => {
      if (Date.now() - checkedAt < 5000) return true;
      const { rows } = await pool.query(`SELECT 1 FROM sessions s JOIN users u ON u.id = s.user_id JOIN memberships m ON m.user_id = u.id AND m.org_id = $2
        WHERE s.id = $1 AND s.expires_at > now() AND NOT u.locked AND m.role IN ('location_manager', 'producer')`, [sessionId, l.org_id]).catch(() => ({ rows: [] }));
      if (rows.length) checkedAt = Date.now();
      return rows.length > 0;
    };
    const push = async () => {
      if (closed) return;
      try {
        if (!(await allowed())) return stop();
        res.write('data: ' + JSON.stringify(await sharedBoard(l)) + '\n\n');
      } catch { stop(); }
    };
    function stop() {
      if (closed) return;
      closed = true;
      clearInterval(tick);
      clearTimeout(timer);
      unsubscribe();
      const left = (streams.get(sessionId) ?? 1) - 1;
      if (left > 0) streams.set(sessionId, left); else streams.delete(sessionId);
      openStreams -= 1;
      res.end();
    }
    req.raw.on('close', stop);
    try {
      // Bursts of changes (one metric write touches several rows) become one push.
      // A change invalidates the shared board, so the push after it always reflects the new state.
      unsubscribe = await app.live.subscribe(l.id, () => { boards.delete(l.id); clearTimeout(timer); timer = setTimeout(push, 200); });
    } catch {
      return stop(); // no live connection: end the stream; the browser reconnects
    }
    tick = setInterval(push, 30000);
    await push();
  });

  app.get('/locations/:id/today', async (req) => {
    const l = await opsLocation(pool, req, req.params.id, ['location_manager', 'producer', 'inventory', 'finance_admin']);
    const [{ rows: sessions }, { rows: [counts] }] = await Promise.all([
      pool.query(`SELECT b.id, b.status, b.starts_at, b.ends_at, bo.name AS booth, c.name AS campaign, b.producer_id IS NULL AS needs_producer FROM bookings b JOIN booths bo ON bo.id = b.booth_id JOIN campaigns c ON c.id = b.campaign_id
        WHERE bo.location_id = $1 AND b.starts_at >= date_trunc('day', now()) AND b.starts_at < date_trunc('day', now()) + interval '1 day' AND b.status NOT IN ('expired', 'cancelled') ORDER BY b.starts_at`, [l.id]),
      pool.query(`SELECT
          (SELECT count(*) FROM incidents i JOIN bookings b ON b.id = i.booking_id JOIN booths bo ON bo.id = b.booth_id WHERE bo.location_id = $1 AND i.status <> 'resolved')::int AS open_incidents,
          (SELECT count(*) FROM shipments s JOIN bookings b ON b.id = s.booking_id JOIN booths bo ON bo.id = b.booth_id WHERE bo.location_id = $1 AND s.status = 'expected')::int AS shipments_expected,
          (SELECT count(*) FROM bookings b JOIN booths bo ON bo.id = b.booth_id WHERE bo.location_id = $1 AND b.status = 'confirmed' AND b.producer_id IS NULL AND b.starts_at < now() + interval '72 hours')::int AS producer_gaps`, [l.id]),
    ]);
    return { location: l.name, sessions, ...counts };
  });
}
