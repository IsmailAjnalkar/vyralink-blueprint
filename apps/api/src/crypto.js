// TOTP (RFC 6238) and secret encryption at rest (AES-256-GCM). Node's crypto only.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('bad base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** HOTP/TOTP code for a secret (raw bytes) at a Unix time. */
export function totp(secret, unixSeconds = Date.now() / 1000, digits = 6, step = 30) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(unixSeconds / step)));
  const h = crypto.createHmac('sha1', secret).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, '0');
}
/**
 * Returns the matched time step for the current code or one step either side (clock drift), else null.
 * Steps at or before `afterStep` are refused, so a code works once. Constant-time compare.
 */
export function totpStep(secret, code, afterStep = null, now = Date.now() / 1000) {
  if (!/^\d{6}$/.test(String(code))) return null;
  for (const d of [-1, 0, 1]) {
    const step = Math.floor(now / 30) + d;
    if (afterStep != null && step <= Number(afterStep)) continue;
    if (crypto.timingSafeEqual(Buffer.from(totp(secret, step * 30)), Buffer.from(String(code)))) return step;
  }
  return null;
}
export const verifyTotp = (secret, code, now = Date.now() / 1000) => totpStep(secret, code, null, now) != null;
export const newTotpSecret = () => crypto.randomBytes(20);

function key() {
  const s = process.env.APP_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('APP_SECRET is required in production');
  return crypto.createHash('sha256').update(s ?? 'dev-only-app-secret-do-not-use-in-production').digest();
}
export function seal(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}
export function open(sealed) {
  const [iv, tag, enc] = sealed.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]);
}
