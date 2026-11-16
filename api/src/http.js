// Shared request helpers: errors, auth, roles, audit, notifications, body schemas.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.statusCode = status;
    this.code = code ?? (status === 404 ? 'not_found' : status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'bad_request');
  }
}
export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (why = 'You don’t have access to this') => new HttpError(403, why);
export const conflict = (why, code) => new HttpError(409, why, code);
export const bad = (why, code) => new HttpError(400, why, code);

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function checkPassword(pw, stored) {
  const [, salt, key] = stored.split('$');
  const got = await scrypt(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(got, Buffer.from(key, 'hex'));
}
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const newToken = () => crypto.randomBytes(32).toString('base64url');

/** JSON body schema from a compact spec: { name: 'string', qty: 'integer?' } (trailing ? = optional). */
export function body(spec) {
  const properties = {};
  const required = [];
  for (const [k, raw] of Object.entries(spec)) {
    const optional = typeof raw === 'string' && raw.endsWith('?');
    const t = typeof raw === 'string' ? raw.replace(/\?$/, '') : raw;
    properties[k] = typeof t === 'string'
      ? ({ string: { type: 'string', minLength: 1, maxLength: 5000 }, text: { type: 'string', maxLength: 200000 }, integer: { type: 'integer' }, number: { type: 'number' }, boolean: { type: 'boolean' }, uuid: { type: 'string', format: 'uuid' }, datetime: { type: 'string', format: 'date-time' }, strings: { type: 'array', items: { type: 'string', maxLength: 500 }, maxItems: 100 }, uuids: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 100 }, object: { type: 'object' } })[t]
      : t;
    if (!optional) required.push(k);
  }
  return { body: { type: 'object', additionalProperties: false, properties, required } };
}

// ---------------------------------------------------------------- roles
export const BRAND = ['brand_owner', 'brand_marketing_manager'];
export const OWNER = ['brand_owner'];
export const OPS = ['location_manager', 'producer', 'inventory', 'finance_admin'];

/** Requires a signed-in user. */
export function user(req) {
  if (!req.user) throw new HttpError(401, 'Sign in first', 'unauthenticated');
  return req.user;
}
/** Requires membership of the org named by the x-org-id header, with one of the roles. Returns { orgId, role }. */
export function member(req, roles) {
  user(req);
  const m = req.membership;
  if (!m) throw forbidden('Choose an organization (x-org-id header) you belong to');
  if (roles && !roles.includes(m.role)) throw forbidden(`This needs one of: ${roles.join(', ')}`);
  return m; // suspended organizations are refused earlier, in app.js onRequest (org actions always carry x-org-id)
}
export function superAdmin(req) {
  if (!user(req).is_super_admin) throw forbidden('Platform administrators only');
  return req.user;
}

// ---------------------------------------------------------------- side effects inside a transaction
export async function audit(db, req, action, targetType, targetId, detail = {}) {
  await db.query('INSERT INTO audit_log (actor_id, org_id, action, target_type, target_id, detail, ip) VALUES ($1, $2, $3, $4, $5, $6, $7)', [req.user?.id ?? null, req.membership?.orgId ?? null, action, targetType, targetId == null ? null : String(targetId), detail, req.ip]);
}
export async function notify(db, userIds, kind, text, link = null) {
  for (const id of new Set(userIds.filter(Boolean))) await db.query('INSERT INTO notifications (user_id, kind, body, link) VALUES ($1, $2, $3, $4)', [id, kind, text, link]);
}
export async function orgUsers(db, orgId, roles) {
  const { rows } = await db.query('SELECT user_id FROM memberships WHERE org_id = $1 AND ($2::text[] IS NULL OR role = ANY($2))', [orgId, roles ?? null]);
  return rows.map((r) => r.user_id);
}
export async function one(db, sql, params, what = 'Not found') {
  const { rows } = await db.query(sql, params);
  if (!rows.length) throw notFound(what);
  return rows[0];
}
