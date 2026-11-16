import Fastify from 'fastify';
import { sha256 } from './http.js';
import identity from './routes/identity.js';
import catalog from './routes/catalog.js';
import studio from './routes/studio.js';
import finance from './routes/finance.js';

/** Builds the API. Auth: `Authorization: Bearer <token>` from /auth/login; org context: `x-org-id` header. */
export function buildApp({ pool, logger = false }) {
  const app = Fastify({ logger, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  app.decorate('pool', pool);

  app.addHook('onRequest', async (req) => {
    req.user = null;
    req.membership = null;
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (token) {
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.name, u.is_super_admin FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.locked`, [sha256(token)]);
      req.user = rows[0] ?? null;
    }
    const orgId = req.headers['x-org-id'];
    if (req.user && typeof orgId === 'string' && /^[0-9a-f-]{36}$/i.test(orgId)) {
      const { rows } = await pool.query(
        `SELECT m.org_id, m.role, o.kind, o.status FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.org_id = $1 AND m.user_id = $2`, [orgId, req.user.id]);
      if (rows[0]) req.membership = { orgId: rows[0].org_id, role: rows[0].role, kind: rows[0].kind, orgStatus: rows[0].status };
    }
  });

  // A missing body counts as {}, so endpoints whose fields are all optional accept no body; required fields still fail validation.
  app.addHook('preValidation', async (req) => {
    if (req.body === undefined && ['POST', 'PUT', 'PATCH'].includes(req.method)) req.body = {};
  });

  app.setErrorHandler((err, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: 'Please fix the request', code: 'invalid_input', details: err.validation.map((v) => `${v.instancePath || 'body'} ${v.message}`) });
    if (err.code === '23P01') return reply.code(409).send({ error: err.friendly ?? 'That time overlaps an existing booking (including setup and teardown)', code: 'overlap' });
    // No database detail in responses: it would reveal other records (e.g. which emails have accounts).
    if (err.code === '23505') return reply.code(409).send({ error: 'That already exists', code: 'duplicate' });
    if (err.code === '23514') return reply.code(400).send({ error: 'A value is out of range', code: 'invalid_input' });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message, code: err.code ?? 'bad_request' });
    req.log.error(err);
    return reply.code(500).send({ error: 'Something went wrong', code: 'internal' });
  });

  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true };
  });

  app.register(identity);
  app.register(catalog);
  app.register(studio);
  app.register(finance);
  return app;
}
