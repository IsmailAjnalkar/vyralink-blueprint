// File upload and download (product images, verification documents) through the storage provider.
// The type is decided by the file's first bytes, never by the declared content type or the file name.
import { createHash, randomUUID } from 'node:crypto';
import { audit, bad, conflict, forbidden, member, notFound, one, platformStaff, user, BRAND } from '../http.js';
import { storage } from '../providers.js';

/** @type {[string, (b: Buffer) => boolean][]} */
const SNIFF = [
  ['image/png', (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['image/jpeg', (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/webp', (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP'],
  ['application/pdf', (b) => b.length > 5 && b.toString('latin1', 0, 5) === '%PDF-'],
];
const PURPOSES = {
  product_image: { roles: BRAND, types: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 5 * 2 ** 20 },
  verification_document: { roles: ['brand_owner'], types: ['image/png', 'image/jpeg', 'application/pdf'], maxBytes: 10 * 2 ** 20 },
};
const MAX = 10 * 2 ** 20;
const ORG_QUOTA_BYTES = 1024 * 2 ** 20; // ponytail: flat 1 GB per organization; make it a plan setting when plans exist
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function files(app) {
  const { pool } = app;

  app.register(async (raw) => {
    // Any declared type is accepted as raw bytes; the sniffing below decides what the file really is.
    raw.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: MAX }, (_req, body, done) => done(null, body));
    raw.post('/files/:purpose', { bodyLimit: MAX }, async (req, reply) => {
      const rule = PURPOSES[req.params.purpose];
      if (!rule) throw notFound('Unknown upload type');
      const m = member(req, rule.roles);
      const bytes = req.body;
      if (!Buffer.isBuffer(bytes) || !bytes.length) throw bad('Send the file as the request body');
      const type = SNIFF.find(([, test]) => test(bytes))?.[0];
      if (!type || !rule.types.includes(type)) throw bad(`Upload a ${rule.types.map((t) => t.split('/')[1].toUpperCase()).join(', ')} file`, 'file_type');
      if (bytes.length > rule.maxBytes) throw bad(`Files can be at most ${rule.maxBytes / 2 ** 20} MB`, 'file_too_large');
      const { rows: [{ used }] } = await pool.query('SELECT COALESCE(sum(size_bytes), 0)::bigint AS used FROM files WHERE org_id = $1', [m.orgId]);
      if (Number(used) + bytes.length > ORG_QUOTA_BYTES) throw conflict('Your organization’s file storage is full', 'storage_quota');
      const key = randomUUID();
      await storage().put(key, bytes);
      const { rows: [f] } = await pool.query(
        'INSERT INTO files (org_id, uploaded_by, purpose, content_type, size_bytes, sha256, storage_key) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, purpose, content_type, size_bytes, created_at',
        [m.orgId, req.user.id, req.params.purpose, type, bytes.length, createHash('sha256').update(bytes).digest('hex'), key]);
      await audit(pool, req, 'file.uploaded', 'file', f.id, { purpose: f.purpose, type, size: bytes.length });
      reply.code(201);
      return f;
    });
  });

  /** Product images: any signed-in user (sellers see what they'll sell). Documents: the organization's Brand Owners and platform staff. */
  app.get('/files/:id', async (req, reply) => {
    user(req);
    if (!UUID.test(req.params.id)) throw notFound('File not found');
    const f = await one(pool, 'SELECT * FROM files WHERE id = $1', [req.params.id], 'File not found');
    const owner = req.membership?.orgId === f.org_id && req.membership.role === 'brand_owner';
    if (f.purpose !== 'product_image' && !owner) {
      try { platformStaff(req); } catch { throw notFound('File not found'); }
    }
    const bytes = await storage().get(f.storage_key);
    return reply
      .header('content-type', f.content_type)
      .header('content-disposition', `${f.content_type.startsWith('image/') ? 'inline' : 'attachment'}; filename="${f.purpose}-${f.id}.${f.content_type.split('/')[1]}"`)
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "default-src 'none'; sandbox")
      .header('cache-control', 'private, max-age=3600')
      .send(bytes);
  });
}

/** A file this organization uploaded for this purpose (used when attaching it to a record). */
export async function ownFile(db, orgId, fileId, purpose) {
  const { rows: [f] } = await db.query('SELECT id FROM files WHERE id = $1 AND org_id = $2 AND purpose = $3', [fileId, orgId, purpose]);
  if (!f) throw forbidden('That file isn’t one of your uploads');
  return f.id;
}
