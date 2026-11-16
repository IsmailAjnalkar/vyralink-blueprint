import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { liveHub } from './live.js';
import { HttpError, sha256 } from './http.js';
import auth from './routes/auth.js';
import identity from './routes/identity.js';
import catalog from './routes/catalog.js';
import studio from './routes/studio.js';
import finance from './routes/finance.js';

export const API_PREFIX = '/v1';

/**
 * Builds the API. Auth: `Authorization: Bearer <token>` (the web app turns its httpOnly cookie into this header).
 * Organization context: `x-org-id` header. Options: rateLimitScale multiplies every limit (tests raise it).
 */
export function buildApp({ pool, logger = false, rateLimitScale = Number(process.env.RATE_LIMIT_SCALE ?? 1), trustProxy = Number(process.env.TRUST_PROXY_HOPS ?? 0) }) {
  const app = Fastify({ logger, trustProxy, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  app.decorate('pool', pool);
  app.decorate('live', liveHub(pool));
  app.addHook('onClose', () => app.live.close());
  app.decorate('rateLimitScale', rateLimitScale);

  app.register(swagger, {
    openapi: {
      info: { title: 'Vyralink + Creator Hub API', version: '1.0.0', description: 'Money in integer cents; rates in basis points. Organization context via x-org-id.' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' }, org: { type: 'apiKey', in: 'header', name: 'x-org-id' } } },
      security: [{ bearer: [] }],
    },
  });
  app.register(rateLimit, { global: true, max: 600 * rateLimitScale, timeWindow: '1 minute', errorResponseBuilder: () => ({ statusCode: 429, error: 'Too many requests. Slow down and try again shortly.', code: 'rate_limited' }) });

  app.addHook('onRequest', async (req) => {
    req.user = null;
    req.membership = null;
    req.session = null;
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (token) {
      const { rows: [s] } = await pool.query(
        `SELECT s.id AS session_id, s.mfa_passed, s.pending_mfa, u.id, u.email, u.name, u.is_super_admin, u.is_support_admin, u.email_verified_at, (u.mfa_enabled_at IS NOT NULL) AS mfa_enabled
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.locked`, [sha256(token)]);
      if (s?.pending_mfa) req.pendingMfa = { sessionId: s.session_id, userId: s.id }; // only /auth/mfa/verify accepts this session
      else if (s) {
        const { session_id, mfa_passed, pending_mfa, ...u } = s;
        req.user = u;
        req.session = { id: session_id, mfaPassed: mfa_passed };
        pool.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`, [session_id]).catch(() => {});
      }
    }
    const orgId = req.headers['x-org-id'];
    if (req.user && typeof orgId === 'string' && /^[0-9a-f-]{36}$/i.test(orgId)) {
      const { rows } = await pool.query(
        `SELECT m.org_id, m.role, o.kind, o.status FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.org_id = $1 AND m.user_id = $2`, [orgId, req.user.id]);
      if (rows[0]) req.membership = { orgId: rows[0].org_id, role: rows[0].role, kind: rows[0].kind, orgStatus: rows[0].status };
      // A suspended organization is read-only for every member, on every route (one gate, before any handler).
      if (rows[0]?.status === 'suspended' && req.method !== 'GET') throw new HttpError(403, 'This organization is suspended. Contact support.', 'org_suspended');
    }
  });

  // A missing body counts as {}, so endpoints whose fields are all optional accept no body; required fields still fail validation.
  app.addHook('preValidation', async (req) => {
    if (req.body === undefined && ['POST', 'PUT', 'PATCH'].includes(req.method)) req.body = {};
  });

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'Please fix the request', code: 'invalid_input', details: err.validation.map((v) => `${v.instancePath || 'body'} ${v.message}`) });
    if (err.statusCode === 429 && !(err instanceof HttpError)) return reply.code(429).send({ error: 'Too many requests. Slow down and try again shortly.', code: 'rate_limited' });
    if (err.code === '23P01') return reply.code(409).send({ error: err.friendly ?? 'That time overlaps an existing booking (including setup and teardown)', code: 'overlap' });
    // No database detail in responses: it would reveal other records.
    if (err.code === '23505') return reply.code(409).send({ error: 'That already exists', code: 'duplicate' });
    if (err.code === '23514') return reply.code(400).send({ error: 'A value is out of range', code: 'invalid_input' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message, code: err.code ?? 'bad_request' });
    req.log.error(err);
    return reply.code(500).send({ error: 'Something went wrong', code: 'internal' });
  });

  app.register(async (v1) => {
    v1.get('/health', { config: { rateLimit: false } }, async () => {
      await pool.query('SELECT 1');
      return { ok: true };
    });
    /** Ready = database reachable and a worker heartbeat in the last 2 minutes. */
    v1.get('/health/ready', { config: { rateLimit: false } }, async (req, reply) => {
      await pool.query('SELECT 1');
      const { rows: [w] } = await pool.query('SELECT max(seen_at) AS seen FROM worker_heartbeats');
      const workerOk = Boolean(w?.seen && Date.now() - new Date(w.seen).getTime() < 120000);
      reply.code(workerOk ? 200 : 503);
      return { database: true, worker: workerOk };
    });
    v1.get('/openapi.json', { config: { rateLimit: false }, schema: { hide: true } }, async () => app.swagger());
    v1.register(auth);
    v1.register(identity);
    v1.register(catalog);
    v1.register(studio);
    v1.register(finance);
  }, { prefix: API_PREFIX });
  return app;
}
