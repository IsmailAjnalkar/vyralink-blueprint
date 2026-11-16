// Accounts: sign-up with email verification, login with lockout and MFA, password reset, sessions, invitations.
// Every answer that could reveal whether an email has an account is the same either way.
import { base32Encode, newTotpSecret, open, seal, totpStep } from '../crypto.js';
import { setting, tx } from '../db.js';
import { HttpError, audit, bad, body, checkPassword, conflict, forbidden, hashPassword, member, newToken, notFound, one, sha256, superAdmin, user } from '../http.js';
import { email, enqueue } from '../jobs.js';

const SESSION_DAYS = 30;
const PENDING_MFA_MINUTES = 10;
const BRAND_ROLES = ['brand_owner', 'brand_marketing_manager', 'brand_finance'];
const OPS_ROLES = ['location_manager', 'producer', 'inventory', 'finance_admin'];
export const allowedRoles = (kind) => (kind === 'brand' ? BRAND_ROLES : OPS_ROLES);
export const managerRoles = (kind) => (kind === 'brand' ? ['brand_owner'] : ['location_manager']);

const PASSWORD = { type: 'string', minLength: 12, maxLength: 200 };
const EMAIL = { type: 'string', format: 'email', maxLength: 320 };

export async function startSession(db, req, userId, { pendingMfa = false, mfaPassed = false } = {}) {
  const token = newToken();
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, pending_mfa, mfa_passed, user_agent, ip)
     VALUES ($1, $2, now() + make_interval(mins => $3), $4, $5, $6, $7)`,
    [sha256(token), userId, pendingMfa ? PENDING_MFA_MINUTES : SESSION_DAYS * 1440, pendingMfa, mfaPassed, String(req.headers['user-agent'] ?? '').slice(0, 300), req.ip]);
  return token;
}
async function issueToken(db, kind, fields, hours) {
  const token = newToken();
  await db.query(`INSERT INTO auth_tokens (token_hash, kind, user_id, org_id, role, email, created_by, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(hours => $8))`,
    [sha256(token), kind, fields.userId ?? null, fields.orgId ?? null, fields.role ?? null, fields.email ?? null, fields.createdBy ?? null, hours]);
  return token;
}
async function useToken(db, kind, token) {
  const t = await one(db, `SELECT * FROM auth_tokens WHERE token_hash = $1 AND kind = $2 FOR UPDATE`, [sha256(token ?? ''), kind], 'This link is invalid');
  if (t.used_at) throw conflict('This link was already used', 'token_used');
  if (t.expires_at < new Date()) throw conflict('This link has expired. Ask for a new one.', 'token_expired');
  await db.query('UPDATE auth_tokens SET used_at = now() WHERE token_hash = $1', [t.token_hash]);
  return t;
}
const sessionToken = (req) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

export default async function auth(app) {
  const { pool } = app;
  const strict = { rateLimit: { max: 10 * app.rateLimitScale, timeWindow: '1 minute' } };

  // ---------------------------------------------------------------- sign-up and verification
  app.post('/auth/signup', { config: strict, schema: body({ email: EMAIL, password: PASSWORD, name: 'string', kind: { enum: ['brand', 'seller', 'staff'] }, companyName: 'string?' }) }, async (req, reply) => {
    const b = req.body;
    if (b.kind === 'brand' && !b.companyName) throw bad('Company name is required for a brand account');
    await tx(pool, async (db) => {
      const { rows: [existing] } = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [b.email]);
      if (existing) return enqueue(db, 'email', email.exists(b.email));
      const { rows: [u] } = await db.query('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name', [b.email, b.name, await hashPassword(b.password)]);
      let orgId = null;
      if (b.kind === 'brand') {
        ({ rows: [{ id: orgId }] } = await db.query(`INSERT INTO orgs (kind, name) VALUES ('brand', $1) RETURNING id`, [b.companyName]));
        await db.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'brand_owner')`, [orgId, u.id]);
      } else if (b.kind === 'seller') {
        await db.query('INSERT INTO seller_profiles (user_id, display_name) VALUES ($1, $2)', [u.id, b.name]);
      } // staff: plain account; joins a Creator Hub organization by invitation
      await audit(db, { user: u, membership: orgId ? { orgId } : null, ip: req.ip }, 'user.signup', 'user', u.id, { kind: b.kind });
      await enqueue(db, 'email', email.verify(u.email, await issueToken(db, 'verify_email', { userId: u.id }, 24)));
    });
    // Same answer whether or not the email already had an account.
    return reply.code(202).send({ ok: true, message: 'Check your email to confirm your address.' });
  });

  app.post('/auth/verify-email', { config: strict, schema: body({ token: 'string' }) }, async (req) => {
    return tx(pool, async (db) => {
      const t = await useToken(db, 'verify_email', req.body.token);
      await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [t.user_id]);
      await audit(db, { user: { id: t.user_id }, ip: req.ip }, 'user.email_verified', 'user', t.user_id);
      const { rows: [u] } = await db.query('SELECT mfa_enabled_at FROM users WHERE id = $1', [t.user_id]);
      if (u.mfa_enabled_at) return { verified: true }; // MFA users sign in normally
      return { verified: true, token: await startSession(db, req, t.user_id) };
    });
  });

  app.post('/auth/resend-verification', { config: strict, schema: body({ email: EMAIL }) }, async (req, reply) => {
    await tx(pool, async (db) => {
      const { rows: [u] } = await db.query('SELECT id, email FROM users WHERE lower(email) = lower($1) AND email_verified_at IS NULL', [req.body.email]);
      if (u) await enqueue(db, 'email', email.verify(u.email, await issueToken(db, 'verify_email', { userId: u.id }, 24)));
    });
    return reply.code(202).send({ ok: true });
  });

  // ---------------------------------------------------------------- login, lockout, MFA
  app.post('/auth/login', { config: strict, schema: body({ email: 'string', password: 'string' }) }, async (req) => {
    return tx(pool, async (db) => {
      const { rows: [u] } = await db.query('SELECT id, password_hash, locked, locked_until, email_verified_at, mfa_enabled_at FROM users WHERE lower(email) = lower($1) FOR UPDATE', [req.body.email]);
      if (u?.locked_until && u.locked_until > new Date()) throw new HttpError(429, 'Too many failed attempts. Try again later or reset your password.', 'account_locked');
      // Same answer for unknown email and wrong password (no account probing).
      if (!u || !(await checkPassword(req.body.password, u.password_hash))) {
        if (u) {
          const max = await setting(db, 'lockout_after_failures');
          const minutes = await setting(db, 'lockout_minutes');
          await db.query(`UPDATE users SET failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
            locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END WHERE id = $1`, [u.id, max, minutes]);
        }
        return { _fail: true };
      }
      if (u.locked) throw forbidden('This account is locked. Contact support.');
      if (!u.email_verified_at) throw forbidden('Confirm your email first. We can send the link again.');
      // With MFA on, the password alone never clears the failure counter: only a correct code does (mfa/verify).
      // Otherwise re-entering the password between guesses would reset the count and allow unlimited code guessing.
      if (u.mfa_enabled_at) return { mfaRequired: true, token: await startSession(db, req, u.id, { pendingMfa: true }) };
      await db.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [u.id]);
      await audit(db, { user: { id: u.id }, ip: req.ip }, 'user.login', 'user', u.id);
      return { token: await startSession(db, req, u.id) };
    }).then((r) => {
      // The failure counter must commit, so the 401 is raised after the transaction.
      if (r._fail) throw new HttpError(401, 'Email or password is wrong', 'invalid_credentials');
      return r;
    });
  });

  app.post('/auth/mfa/verify', { config: strict, schema: body({ code: 'string' }) }, async (req) => {
    if (!req.pendingMfa) throw new HttpError(401, 'Sign in with your password first', 'unauthenticated');
    return tx(pool, async (db) => {
      const u = await one(db, 'SELECT id, mfa_secret_enc, mfa_last_step, locked_until FROM users WHERE id = $1 FOR UPDATE', [req.pendingMfa.userId]);
      if (u.locked_until && u.locked_until > new Date()) {
        await db.query('DELETE FROM sessions WHERE id = $1', [req.pendingMfa.sessionId]);
        return { _locked: true };
      }
      // A code is accepted once: steps at or before the last accepted one are refused (no replay).
      const step = totpStep(open(u.mfa_secret_enc), req.body.code, u.mfa_last_step);
      if (step == null) {
        const max = await setting(db, 'lockout_after_failures');
        const minutes = await setting(db, 'lockout_minutes');
        const { rows: [after] } = await db.query(`UPDATE users SET failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
          locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END WHERE id = $1 RETURNING locked_until`, [u.id, max, minutes]);
        // Too many wrong codes: the half-signed-in session is destroyed; the password step starts over after the lock.
        if (after.locked_until && after.locked_until > new Date()) await db.query('DELETE FROM sessions WHERE id = $1', [req.pendingMfa.sessionId]);
        return { _fail: true };
      }
      await db.query(`UPDATE sessions SET pending_mfa = false, mfa_passed = true, expires_at = now() + make_interval(days => $2) WHERE id = $1`, [req.pendingMfa.sessionId, SESSION_DAYS]);
      await db.query('UPDATE users SET failed_logins = 0, mfa_last_step = $2 WHERE id = $1', [u.id, step]);
      await audit(db, { user: { id: u.id }, ip: req.ip }, 'user.login', 'user', u.id, { mfa: true });
      return { token: sessionToken(req) };
    }).then((r) => {
      if (r._locked) throw new HttpError(429, 'Too many failed attempts. Try again later.', 'account_locked');
      if (r._fail) throw new HttpError(401, 'That code is wrong or expired', 'invalid_code');
      return r;
    });
  });

  /** Starts enrollment: returns the secret once (for the authenticator app). Not active until /enable. */
  app.post('/auth/mfa/setup', async (req) => {
    const u = user(req);
    if (u.mfa_enabled) throw conflict('Two-step verification is already on');
    const secret = newTotpSecret();
    await pool.query('UPDATE users SET mfa_secret_enc = $2 WHERE id = $1', [u.id, seal(secret)]);
    const b32 = base32Encode(secret);
    return { secret: b32, otpauthUrl: `otpauth://totp/Vyralink:${encodeURIComponent(u.email)}?secret=${b32}&issuer=Vyralink&digits=6&period=30` };
  });

  app.post('/auth/mfa/enable', { config: strict, schema: body({ code: 'string' }) }, async (req) => {
    const u = user(req);
    return tx(pool, async (db) => {
      const row = await one(db, 'SELECT mfa_secret_enc, mfa_enabled_at FROM users WHERE id = $1 FOR UPDATE', [u.id]);
      if (row.mfa_enabled_at) throw conflict('Two-step verification is already on');
      if (!row.mfa_secret_enc) throw conflict('Start setup first');
      const step = totpStep(open(row.mfa_secret_enc), req.body.code);
      if (step == null) throw new HttpError(400, 'That code is wrong or expired', 'invalid_code');
      await db.query('UPDATE users SET mfa_enabled_at = now(), mfa_last_step = $2 WHERE id = $1', [u.id, step]);
      await db.query('UPDATE sessions SET mfa_passed = true WHERE id = $1', [req.session.id]);
      await db.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [u.id, req.session.id]); // other devices sign in again with MFA
      await audit(db, req, 'user.mfa_enabled', 'user', u.id);
      return { enabled: true };
    });
  });

  // ---------------------------------------------------------------- password reset
  app.post('/auth/password-reset', { config: strict, schema: body({ email: EMAIL }) }, async (req, reply) => {
    await tx(pool, async (db) => {
      const { rows: [u] } = await db.query('SELECT id, email FROM users WHERE lower(email) = lower($1) AND NOT locked', [req.body.email]);
      if (u) await enqueue(db, 'email', email.reset(u.email, await issueToken(db, 'reset_password', { userId: u.id }, 1)));
    });
    return reply.code(202).send({ ok: true, message: 'If that email has an account, a reset link is on its way.' });
  });

  app.post('/auth/password-reset/confirm', { config: strict, schema: body({ token: 'string', password: PASSWORD }) }, async (req) => {
    return tx(pool, async (db) => {
      const t = await useToken(db, 'reset_password', req.body.token);
      // The reset proves control of the inbox; every existing session is signed out.
      await db.query('UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [t.user_id, await hashPassword(req.body.password)]);
      await db.query('DELETE FROM sessions WHERE user_id = $1', [t.user_id]);
      await db.query(`UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND kind = 'reset_password' AND used_at IS NULL`, [t.user_id]);
      await audit(db, { user: { id: t.user_id }, ip: req.ip }, 'user.password_reset', 'user', t.user_id);
      return { ok: true };
    });
  });

  // ---------------------------------------------------------------- me, sessions
  app.get('/me', async (req) => {
    const u = user(req);
    const { rows: memberships } = await pool.query('SELECT o.id AS org_id, o.name, o.kind, o.status, m.role FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = $1 ORDER BY o.name', [u.id]);
    const { rows: [seller] } = await pool.query('SELECT * FROM seller_profiles WHERE user_id = $1', [u.id]);
    const privileged = u.is_super_admin || u.is_support_admin || memberships.some((m) => m.role === 'finance_admin');
    return { user: u, memberships, sellerProfile: seller ?? null, mfa: { enabled: u.mfa_enabled, required: privileged, passed: req.session.mfaPassed } };
  });

  app.get('/auth/sessions', async (req) => {
    const u = user(req);
    const { rows } = await pool.query('SELECT id, created_at, last_seen_at, user_agent, ip FROM sessions WHERE user_id = $1 AND NOT pending_mfa AND expires_at > now() ORDER BY last_seen_at DESC', [u.id]);
    return rows.map((s) => ({ ...s, current: s.id === req.session.id }));
  });

  app.delete('/auth/sessions/:id', async (req) => {
    const u = user(req);
    const { rowCount } = await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, u.id]);
    if (!rowCount) throw notFound('Session not found');
    await audit(pool, req, 'user.session_revoked', 'session', req.params.id);
    return { ok: true };
  });

  app.post('/auth/logout', async (req) => {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(sessionToken(req))]);
    return { ok: true };
  });

  app.post('/auth/logout-all', async (req) => {
    const u = user(req);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [u.id]);
    await audit(pool, req, 'user.logout_all', 'user', u.id);
    return { ok: true };
  });

  // ---------------------------------------------------------------- organization invitations
  app.post('/orgs/current/invitations', { config: strict, schema: body({ email: EMAIL, role: 'string' }) }, async (req, reply) => {
    const m = member(req);
    if (!managerRoles(m.kind).includes(m.role)) throw forbidden('Only the organization’s owner or location manager can invite members');
    if (!allowedRoles(m.kind).includes(req.body.role)) throw bad(`Role must be one of: ${allowedRoles(m.kind).join(', ')}`);
    return tx(pool, async (db) => {
      const org = await one(db, 'SELECT name FROM orgs WHERE id = $1', [m.orgId]);
      const token = await issueToken(db, 'invite', { orgId: m.orgId, role: req.body.role, email: req.body.email.toLowerCase(), createdBy: req.user.id }, 24 * 7);
      await enqueue(db, 'email', email.invite(req.body.email, token, org.name, req.body.role));
      await audit(db, req, 'member.invited', 'org', m.orgId, { email: req.body.email, role: req.body.role });
      reply.code(201);
      return { invited: req.body.email, role: req.body.role, expiresInDays: 7 };
    });
  });

  app.get('/orgs/current/invitations', async (req) => {
    const m = member(req);
    if (!managerRoles(m.kind).includes(m.role)) throw forbidden();
    return (await pool.query(`SELECT email, role, expires_at, created_at FROM auth_tokens WHERE kind = 'invite' AND org_id = $1 AND used_at IS NULL AND expires_at > now() ORDER BY created_at DESC`, [m.orgId])).rows;
  });

  app.post('/orgs/current/invitations/revoke', { schema: body({ email: EMAIL }) }, async (req) => {
    const m = member(req);
    if (!managerRoles(m.kind).includes(m.role)) throw forbidden();
    const { rowCount } = await pool.query(`UPDATE auth_tokens SET used_at = now() WHERE kind = 'invite' AND org_id = $1 AND lower(email) = lower($2) AND used_at IS NULL`, [m.orgId, req.body.email]);
    await audit(pool, req, 'member.invitation_revoked', 'org', m.orgId, { email: req.body.email });
    return { revoked: rowCount };
  });

  app.post('/invitations/preview', { config: strict, schema: body({ token: 'string' }) }, async (req) => {
    const t = await one(pool, `SELECT a.email, a.role, a.expires_at, a.used_at, o.name AS org FROM auth_tokens a JOIN orgs o ON o.id = a.org_id WHERE a.token_hash = $1 AND a.kind = 'invite'`, [sha256(req.body.token)], 'This invitation is invalid');
    return { org: t.org, role: t.role, email: t.email, expired: t.expires_at < new Date(), used: Boolean(t.used_at) };
  });

  /** The signed-in account must use the invited email address. */
  app.post('/invitations/accept', { config: strict, schema: body({ token: 'string' }) }, async (req) => {
    const u = user(req);
    return tx(pool, async (db) => {
      const t = await useToken(db, 'invite', req.body.token);
      if (t.email !== u.email.toLowerCase()) throw forbidden(`This invitation is for ${t.email}. Sign in with that account.`);
      // The inviter must still be a manager of the organization now, not just when they sent it.
      const org = await one(db, 'SELECT kind FROM orgs WHERE id = $1', [t.org_id], 'This invitation is invalid');
      const { rows: [inviter] } = await db.query('SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2', [t.org_id, t.created_by]);
      if (!inviter || !managerRoles(org.kind).includes(inviter.role)) throw conflict('This invitation is no longer valid. Ask the organization for a new one.', 'invitation_revoked');
      // An invitation adds a member; it never changes an existing member's role (roles change in team settings).
      const { rowCount } = await db.query('INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO NOTHING', [t.org_id, u.id, t.role]);
      if (!rowCount) throw conflict('You are already a member of this organization', 'already_member');
      await audit(db, { user: u, membership: { orgId: t.org_id }, ip: req.ip }, 'member.joined', 'user', u.id, { role: t.role });
      return { orgId: t.org_id, role: t.role };
    });
  });

  // ---------------------------------------------------------------- admin account recovery
  app.post('/admin/users/:id/reset-mfa', async (req) => {
    superAdmin(req);
    await tx(pool, async (db) => {
      await db.query('UPDATE users SET mfa_secret_enc = NULL, mfa_enabled_at = NULL WHERE id = $1', [req.params.id]);
      await db.query('DELETE FROM sessions WHERE user_id = $1', [req.params.id]);
      await audit(db, req, 'user.mfa_reset', 'user', req.params.id);
    });
    return { ok: true };
  });
}
