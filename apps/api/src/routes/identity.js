// Accounts, organizations, members, verification, seller profiles, academy, notifications and the admin console
// (blueprint B01–B03, B18, C01–C04, C07, C27, A01–A04, A09–A12).
import { tx } from '../db.js';
import { COURSES, PASS_PCT, RETAKE_WAIT_HOURS, grade } from '../academy.js';
import { HttpError, audit, bad, body, checkPassword, conflict, forbidden, hashPassword, member, newToken, notify, notFound, one, orgUsers, sha256, superAdmin, user, BRAND } from '../http.js';

const SESSION_DAYS = 30;
const BRAND_ROLES = ['brand_owner', 'brand_marketing_manager'];
const OPS_ROLES = ['location_manager', 'producer', 'inventory', 'finance_admin'];

async function startSession(db, userId) {
  const token = newToken();
  await db.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [sha256(token), userId]);
  return token;
}

/** Verified track record from completed sessions on Vyralink (never self-reported). */
export const SELLER_STATS_SQL = `
  SELECT sp.user_id, sp.display_name, sp.bio, sp.city, sp.categories, sp.languages, sp.rate_cents, sp.commission_bps,
         sp.followers_self_reported, sp.paused,
         COALESCE(st.sessions, 0)::int AS verified_sessions, COALESCE(st.minutes, 0)::int AS verified_minutes,
         COALESCE(st.gmv, 0)::bigint AS verified_gmv_cents,
         CASE WHEN COALESCE(st.minutes, 0) > 0 THEN round(st.gmv * 60.0 / st.minutes)::bigint END AS verified_gmv_per_hour_cents,
         CASE WHEN COALESCE(st.booked, 0) > 0 THEN round(100.0 * st.on_time / st.booked)::int END AS reliability_pct,
         COALESCE((SELECT array_agg(course ORDER BY course) FROM certificates c WHERE c.user_id = sp.user_id AND (c.expires_at IS NULL OR c.expires_at > now())), '{}') AS certificates
  FROM seller_profiles sp
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE b.status = 'completed') AS sessions,
           sum(GREATEST(0, extract(epoch FROM b.actual_end - b.actual_start) / 60 - b.minutes_lost)) FILTER (WHERE b.status = 'completed') AS minutes,
           sum((SELECT COALESCE(sum(o.amount_cents), 0) FROM session_orders o WHERE o.booking_id = b.id AND o.attributed AND o.status <> 'cancelled')) FILTER (WHERE b.status = 'completed' AND b.results_status <> 'pending') AS gmv,
           count(*) FILTER (WHERE b.status IN ('completed', 'no_show')) AS booked,
           count(*) FILTER (WHERE b.status = 'completed' AND b.checked_in_at <= b.starts_at - interval '45 minutes') AS on_time
    FROM bookings b WHERE b.seller_id = sp.user_id) st ON true`;

export default async function identity(app) {
  const { pool } = app;

  // ---------------------------------------------------------------- auth
  app.post('/auth/signup', { schema: body({ email: { type: 'string', format: 'email', maxLength: 320 }, password: { type: 'string', minLength: 12, maxLength: 200 }, name: 'string', kind: { enum: ['brand', 'seller', 'staff'] }, companyName: 'string?' }) }, async (req, reply) => {
    const b = req.body;
    if (b.kind === 'brand' && !b.companyName) throw bad('Company name is required for a brand account');
    const out = await tx(pool, async (db) => {
      const { rows: [u] } = await db.query('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name', [b.email, b.name, await hashPassword(b.password)]);
      let orgId = null;
      if (b.kind === 'brand') {
        ({ rows: [{ id: orgId }] } = await db.query(`INSERT INTO orgs (kind, name) VALUES ('brand', $1) RETURNING id`, [b.companyName]));
        await db.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'brand_owner')`, [orgId, u.id]);
      } else if (b.kind === 'seller') {
        await db.query('INSERT INTO seller_profiles (user_id, display_name) VALUES ($1, $2)', [u.id, b.name]);
      } // staff: plain account, added to a Creator Hub organization by its manager or an admin
      await audit(db, { user: u, membership: orgId ? { orgId } : null, ip: req.ip }, 'user.signup', 'user', u.id, { kind: b.kind });
      return { user: u, orgId, token: await startSession(db, u.id) };
    });
    return reply.code(201).send(out);
  });

  app.post('/auth/login', { schema: body({ email: 'string', password: 'string' }) }, async (req) => {
    const { rows: [u] } = await pool.query('SELECT id, password_hash, locked FROM users WHERE lower(email) = lower($1)', [req.body.email]);
    // Same answer for unknown email and wrong password (no account probing).
    if (!u || !(await checkPassword(req.body.password, u.password_hash))) throw new HttpError(401, 'Email or password is wrong', 'invalid_credentials');
    if (u.locked) throw forbidden('This account is locked. Contact support.');
    return { token: await startSession(pool, u.id) };
  });

  app.post('/auth/logout', async (req) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    return { ok: true };
  });

  app.get('/me', async (req) => {
    const u = user(req);
    const { rows: memberships } = await pool.query('SELECT o.id AS org_id, o.name, o.kind, o.status, m.role FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = $1 ORDER BY o.name', [u.id]);
    const { rows: [seller] } = await pool.query('SELECT * FROM seller_profiles WHERE user_id = $1', [u.id]);
    return { user: u, memberships, sellerProfile: seller ?? null };
  });

  // ---------------------------------------------------------------- organization, members, verification
  app.get('/orgs/current', async (req) => {
    const m = member(req);
    return one(pool, 'SELECT * FROM orgs WHERE id = $1', [m.orgId]);
  });

  app.get('/orgs/current/members', async (req) => {
    const m = member(req);
    const { rows } = await pool.query('SELECT u.id, u.name, u.email, mb.role FROM memberships mb JOIN users u ON u.id = mb.user_id WHERE mb.org_id = $1 ORDER BY u.name', [m.orgId]);
    return rows;
  });

  const managerRole = (kind) => (kind === 'brand' ? ['brand_owner'] : ['location_manager']);
  const allowedRoles = (kind) => (kind === 'brand' ? BRAND_ROLES : OPS_ROLES);

  // ponytail: adds an existing account; email invitations for people without accounts come later.
  app.post('/orgs/current/members', { schema: body({ email: 'string', role: 'string' }) }, async (req, reply) => {
    const m = member(req, null);
    if (!managerRole(m.kind).includes(m.role)) throw forbidden('Only the organization’s owner or location manager can add members');
    if (!allowedRoles(m.kind).includes(req.body.role)) throw bad(`Role must be one of: ${allowedRoles(m.kind).join(', ')}`);
    return tx(pool, async (db) => {
      const u = await one(db, 'SELECT id FROM users WHERE lower(email) = lower($1)', [req.body.email], 'No account with that email yet. Ask them to sign up first.');
      await db.query('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3)', [m.orgId, u.id, req.body.role]);
      await audit(db, req, 'member.added', 'user', u.id, { role: req.body.role });
      await notify(db, [u.id], 'membership', `You were added to an organization as ${req.body.role}`);
      reply.code(201);
      return { userId: u.id, role: req.body.role };
    });
  });

  app.patch('/orgs/current/members/:userId', { schema: body({ role: 'string' }) }, async (req) => {
    const m = member(req);
    if (!managerRole(m.kind).includes(m.role)) throw forbidden();
    if (!allowedRoles(m.kind).includes(req.body.role)) throw bad('Invalid role for this organization');
    return tx(pool, async (db) => {
      const cur = await one(db, 'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2 FOR UPDATE', [m.orgId, req.params.userId], 'Member not found');
      if (cur.role === 'brand_owner' && req.body.role !== 'brand_owner') await assertAnotherOwner(db, m.orgId, req.params.userId);
      await db.query('UPDATE memberships SET role = $3 WHERE org_id = $1 AND user_id = $2', [m.orgId, req.params.userId, req.body.role]);
      await audit(db, req, 'member.role_changed', 'user', req.params.userId, { from: cur.role, to: req.body.role });
      return { ok: true };
    });
  });

  app.delete('/orgs/current/members/:userId', async (req) => {
    const m = member(req);
    if (!managerRole(m.kind).includes(m.role)) throw forbidden();
    return tx(pool, async (db) => {
      const cur = await one(db, 'SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2 FOR UPDATE', [m.orgId, req.params.userId], 'Member not found');
      if (cur.role === 'brand_owner') await assertAnotherOwner(db, m.orgId, req.params.userId);
      await db.query('DELETE FROM memberships WHERE org_id = $1 AND user_id = $2', [m.orgId, req.params.userId]);
      await audit(db, req, 'member.removed', 'user', req.params.userId);
      return { ok: true };
    });
  });

  async function assertAnotherOwner(db, orgId, exceptUserId) {
    const { rows } = await db.query(`SELECT 1 FROM memberships WHERE org_id = $1 AND role = 'brand_owner' AND user_id <> $2`, [orgId, exceptUserId]);
    if (!rows.length) throw conflict('An organization needs at least one Brand Owner. Make someone else owner first.', 'last_owner');
  }

  app.post('/orgs/current/verification', { schema: body({ details: 'object', documents: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', required: ['type', 'fileName'], properties: { type: { type: 'string' }, fileName: { type: 'string' } } } } }) }, async (req, reply) => {
    const m = member(req, ['brand_owner']);
    return tx(pool, async (db) => {
      const org = await one(db, 'SELECT status FROM orgs WHERE id = $1 FOR UPDATE', [m.orgId]);
      if (['verified', 'submitted', 'in_review'].includes(org.status)) throw conflict(`Verification is already ${org.status}`);
      const { rows: [{ v }] } = await db.query('SELECT COALESCE(max(version), 0) + 1 AS v FROM verifications WHERE org_id = $1', [m.orgId]);
      const { rows: [ver] } = await db.query('INSERT INTO verifications (org_id, version, details, documents) VALUES ($1, $2, $3, $4) RETURNING *', [m.orgId, v, req.body.details, JSON.stringify(req.body.documents)]);
      await db.query(`UPDATE orgs SET status = 'submitted' WHERE id = $1`, [m.orgId]);
      await audit(db, req, 'verification.submitted', 'verification', ver.id, { version: v });
      reply.code(201);
      return ver;
    });
  });

  app.get('/orgs/current/verification', async (req) => {
    const m = member(req);
    const { rows } = await pool.query('SELECT * FROM verifications WHERE org_id = $1 ORDER BY version DESC', [m.orgId]);
    return rows;
  });

  // ---------------------------------------------------------------- seller profile, academy, search
  app.put('/seller/profile', { schema: body({ displayName: 'string', bio: 'text?', city: 'string?', categories: 'strings?', languages: 'strings?', rateCents: 'integer?', commissionBps: 'integer?', followersSelfReported: 'string?', availability: 'object?' }) }, async (req) => {
    const u = user(req);
    const b = req.body;
    const { rows: [p] } = await pool.query(
      `UPDATE seller_profiles SET display_name = $2, bio = COALESCE($3, bio), city = COALESCE($4, city), categories = COALESCE($5, categories), languages = COALESCE($6, languages),
         rate_cents = COALESCE($7, rate_cents), commission_bps = COALESCE($8, commission_bps), followers_self_reported = COALESCE($9, followers_self_reported), availability = COALESCE($10, availability)
       WHERE user_id = $1 RETURNING *`,
      [u.id, b.displayName, b.bio ?? null, b.city ?? null, b.categories ?? null, b.languages ?? null, b.rateCents ?? null, b.commissionBps ?? null, b.followersSelfReported ?? null, b.availability ?? null]);
    if (!p) throw notFound('This account has no seller profile');
    return p;
  });

  app.get('/seller/profile', async (req) => {
    const u = user(req);
    const p = await one(pool, `${SELLER_STATS_SQL} WHERE sp.user_id = $1`, [u.id], 'This account has no seller profile');
    const { rows: [v] } = await pool.query('SELECT identity_verified, payout_verified, tax_form_on_file, no_shows FROM seller_profiles WHERE user_id = $1', [u.id]);
    return { ...p, ...v };
  });

  app.get('/academy/courses', async () => Object.entries(COURSES).map(([id, c]) => ({ id, title: c.title, questions: c.questions.length, passPct: PASS_PCT })));

  // Questions and options only; the answer key never leaves the server.
  app.get('/academy/:course/assessment', async (req) => {
    user(req);
    const c = COURSES[req.params.course];
    if (!c) throw notFound('Unknown course');
    return { course: req.params.course, title: c.title, passPct: PASS_PCT, questions: c.questions.map(({ q, options }) => ({ q, options })) };
  });

  app.post('/academy/:course/assessment', { schema: body({ answers: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 20 }, maxItems: 100 } }) }, async (req) => {
    const u = user(req);
    const course = req.params.course;
    if (!COURSES[course]) throw notFound('Unknown course');
    return tx(pool, async (db) => {
      await one(db, 'SELECT 1 FROM seller_profiles WHERE user_id = $1 FOR UPDATE', [u.id], 'This account has no seller profile');
      const { rows: [last] } = await db.query('SELECT passed, at FROM assessment_attempts WHERE user_id = $1 AND course = $2 ORDER BY at DESC LIMIT 1', [u.id, course]);
      if (last && !last.passed && Date.now() - last.at.getTime() < RETAKE_WAIT_HOURS * 3.6e6) {
        throw conflict(`You can retake this check after ${new Date(last.at.getTime() + RETAKE_WAIT_HOURS * 3.6e6).toISOString()}`, 'retake_wait');
      }
      const g = grade(course, req.body.answers);
      if (!g) throw bad(`Answer all ${COURSES[course].questions.length} questions`);
      await db.query('INSERT INTO assessment_attempts (user_id, course, score, passed) VALUES ($1, $2, $3, $4)', [u.id, course, g.score, g.passed]);
      if (g.passed) {
        await db.query(
          `INSERT INTO certificates (user_id, course, score, expires_at) VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL THEN NULL ELSE now() + make_interval(months => $4::int) END)
           ON CONFLICT (user_id, course) DO UPDATE SET score = EXCLUDED.score, passed_at = now(), expires_at = EXCLUDED.expires_at`, [u.id, course, g.score, COURSES[course].validMonths]);
      }
      return { course, ...g, passPct: PASS_PCT, ...(g.passed ? {} : { retakeAfterHours: RETAKE_WAIT_HOURS }) };
    });
  });

  app.get('/sellers', async (req) => {
    member(req, BRAND);
    const q = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM (${SELLER_STATS_SQL}) s
       WHERE NOT s.paused AND ($1::text IS NULL OR $1 = ANY(s.categories)) AND ($2::text IS NULL OR $2 = ANY(s.languages))
         AND ($3::bigint IS NULL OR s.verified_gmv_per_hour_cents >= $3) AND (NOT $4::boolean OR s.verified_sessions > 0)
       ORDER BY s.verified_gmv_per_hour_cents DESC NULLS LAST, s.display_name LIMIT 100`,
      [q.category ?? null, q.language ?? null, q.minGmvPerHourCents ? Number(q.minGmvPerHourCents) : null, q.verifiedOnly === 'true']);
    return rows;
  });

  app.get('/sellers/:id', async (req) => {
    member(req, BRAND);
    return one(pool, `${SELLER_STATS_SQL} WHERE sp.user_id = $1 AND NOT sp.paused`, [req.params.id], 'Seller not found');
  });

  // ---------------------------------------------------------------- notifications
  app.get('/notifications', async (req) => {
    const u = user(req);
    const { rows } = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [u.id]);
    return rows;
  });
  app.post('/notifications/:id/read', async (req) => {
    const u = user(req);
    await pool.query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [req.params.id, u.id]);
    return { ok: true };
  });

  // ---------------------------------------------------------------- admin console
  app.get('/admin/verifications', async (req) => {
    superAdmin(req);
    const { rows } = await pool.query(`SELECT v.*, o.name AS org_name FROM verifications v JOIN orgs o ON o.id = v.org_id WHERE ($1::text IS NULL OR v.status = $1) ORDER BY v.created_at`, [req.query.status ?? null]);
    return rows;
  });

  app.post('/admin/verifications/:id/decision', { schema: body({ decision: { enum: ['approve', 'reject', 'request_info'] }, note: 'text?' }) }, async (req) => {
    const admin = superAdmin(req);
    if (req.body.decision !== 'approve' && !req.body.note) throw bad('Explain the decision to the brand (note)');
    return tx(pool, async (db) => {
      const v = await one(db, 'SELECT * FROM verifications WHERE id = $1 FOR UPDATE', [req.params.id], 'Verification not found');
      if (v.status !== 'submitted') throw conflict('This submission has already been decided');
      const { rows: own } = await db.query('SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2', [v.org_id, admin.id]);
      if (own.length) throw forbidden('You can’t verify an organization you belong to');
      const status = { approve: 'approved', reject: 'rejected', request_info: 'info_requested' }[req.body.decision];
      await db.query('UPDATE verifications SET status = $2, note = $3, decided_by = $4, decided_at = now() WHERE id = $1', [v.id, status, req.body.note ?? null, admin.id]);
      await db.query('UPDATE orgs SET status = $2 WHERE id = $1', [v.org_id, req.body.decision === 'approve' ? 'verified' : 'rejected']);
      await audit(db, req, `verification.${status}`, 'verification', v.id, { note: req.body.note });
      await notify(db, await orgUsers(db, v.org_id, ['brand_owner']), 'verification', req.body.decision === 'approve' ? 'Your company is verified. Publishing is unlocked.' : `Verification needs changes: ${req.body.note}`);
      return { status };
    });
  });

  app.post('/admin/orgs', { schema: body({ kind: { enum: ['operator', 'brand'] }, name: 'string' }) }, async (req, reply) => {
    superAdmin(req);
    const { rows: [o] } = await pool.query(`INSERT INTO orgs (kind, name, status) VALUES ($1, $2, CASE WHEN $1 = 'operator' THEN 'verified' ELSE 'unverified' END) RETURNING *`, [req.body.kind, req.body.name]);
    await audit(pool, req, 'org.created', 'org', o.id, { kind: o.kind });
    reply.code(201);
    return o;
  });

  app.post('/admin/orgs/:id/members', { schema: body({ email: 'string', role: 'string' }) }, async (req, reply) => {
    superAdmin(req);
    return tx(pool, async (db) => {
      const org = await one(db, 'SELECT kind FROM orgs WHERE id = $1', [req.params.id], 'Organization not found');
      if (!allowedRoles(org.kind).includes(req.body.role)) throw bad('Invalid role for this organization');
      const u = await one(db, 'SELECT id FROM users WHERE lower(email) = lower($1)', [req.body.email], 'No account with that email');
      await db.query('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role', [req.params.id, u.id, req.body.role]);
      await audit(db, req, 'member.added_by_admin', 'user', u.id, { orgId: req.params.id, role: req.body.role });
      reply.code(201);
      return { userId: u.id };
    });
  });

  app.get('/admin/orgs', async (req) => {
    superAdmin(req);
    const { rows } = await pool.query(`SELECT o.*, (SELECT count(*) FROM memberships m WHERE m.org_id = o.id)::int AS members FROM orgs o ORDER BY o.name`);
    return rows;
  });

  app.post('/admin/orgs/:id/suspend', { schema: body({ reason: 'string' }) }, async (req) => {
    superAdmin(req);
    return tx(pool, async (db) => {
      const { rows: live } = await db.query(`SELECT 1 FROM bookings b JOIN campaigns c ON c.id = b.campaign_id WHERE c.org_id = $1 AND b.status IN ('checked_in', 'in_progress')`, [req.params.id]);
      if (live.length) throw conflict('This organization has a session running now. Suspend after it ends.');
      await db.query(`UPDATE orgs SET status = 'suspended', suspended_reason = $2 WHERE id = $1`, [req.params.id, req.body.reason]);
      await db.query(`UPDATE campaigns SET status = 'cancelled' WHERE org_id = $1 AND status IN ('draft', 'pending_approval', 'published')`, [req.params.id]);
      await audit(db, req, 'org.suspended', 'org', req.params.id, { reason: req.body.reason });
      return { ok: true };
    });
  });

  app.get('/admin/users', async (req) => {
    superAdmin(req);
    const { rows } = await pool.query(`SELECT u.id, u.email, u.name, u.is_super_admin, u.locked,
      COALESCE(json_agg(json_build_object('orgId', m.org_id, 'role', m.role)) FILTER (WHERE m.org_id IS NOT NULL), '[]') AS memberships
      FROM users u LEFT JOIN memberships m ON m.user_id = u.id GROUP BY u.id ORDER BY u.name`);
    return rows;
  });

  app.post('/admin/users/:id/lock', { schema: body({ locked: 'boolean' }) }, async (req) => {
    superAdmin(req);
    await tx(pool, async (db) => {
      await db.query('UPDATE users SET locked = $2 WHERE id = $1', [req.params.id, req.body.locked]);
      if (req.body.locked) await db.query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);
      await audit(db, req, req.body.locked ? 'user.locked' : 'user.unlocked', 'user', req.params.id);
    });
    return { ok: true };
  });

  // Simulates the identity / payout providers' webhooks in development.
  app.post('/admin/sellers/:id/provider-status', { schema: body({ identityVerified: 'boolean?', payoutVerified: 'boolean?', taxFormOnFile: 'boolean?' }) }, async (req) => {
    superAdmin(req);
    const b = req.body;
    const { rows: [p] } = await pool.query(`UPDATE seller_profiles SET identity_verified = COALESCE($2, identity_verified), payout_verified = COALESCE($3, payout_verified), tax_form_on_file = COALESCE($4, tax_form_on_file) WHERE user_id = $1 RETURNING user_id, identity_verified, payout_verified, tax_form_on_file`, [req.params.id, b.identityVerified ?? null, b.payoutVerified ?? null, b.taxFormOnFile ?? null]);
    if (!p) throw notFound('Seller not found');
    await audit(pool, req, 'seller.provider_status', 'user', req.params.id, b);
    return p;
  });

  app.get('/admin/flags', async (req) => {
    superAdmin(req);
    return (await pool.query('SELECT * FROM feature_flags ORDER BY key')).rows;
  });
  app.put('/admin/flags/:key', { schema: body({ enabled: 'boolean', orgIds: 'uuids?' }) }, async (req) => {
    superAdmin(req);
    const { rows: [f] } = await pool.query('UPDATE feature_flags SET enabled = $2, org_ids = COALESCE($3, org_ids) WHERE key = $1 RETURNING *', [req.params.key, req.body.enabled, req.body.orgIds ?? null]);
    if (!f) throw notFound('Unknown flag');
    await audit(pool, req, 'flag.changed', 'flag', f.key, req.body);
    return f;
  });

  app.get('/admin/settings', async (req) => {
    superAdmin(req);
    return Object.fromEntries((await pool.query('SELECT key, value FROM settings ORDER BY key')).rows.map((r) => [r.key, r.value]));
  });
  app.put('/admin/settings/:key', { schema: body({ value: {} }) }, async (req) => {
    superAdmin(req);
    const { rows: [s] } = await pool.query('UPDATE settings SET value = $2 WHERE key = $1 RETURNING *', [req.params.key, JSON.stringify(req.body.value)]);
    if (!s) throw notFound('Unknown setting');
    await audit(pool, req, 'setting.changed', 'setting', s.key, { value: req.body.value });
    return s;
  });

  app.get('/admin/audit', async (req) => {
    superAdmin(req);
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE ($1::text IS NULL OR action LIKE $1 || '%') AND ($2::uuid IS NULL OR org_id = $2) ORDER BY id DESC LIMIT LEAST(COALESCE($3::int, 200), 1000)`,
      [req.query.action ?? null, req.query.orgId ?? null, req.query.limit ?? null]);
    return rows;
  });
}
