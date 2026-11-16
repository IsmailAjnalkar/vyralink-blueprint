// PostgreSQL job queue (transactional outbox). enqueue() runs inside the caller's transaction.
import fs from 'node:fs';
import path from 'node:path';

export async function enqueue(db, kind, payload, runAt = null) {
  await db.query('INSERT INTO jobs (kind, payload, run_at) VALUES ($1, $2, COALESCE($3, now()))', [kind, payload, runAt]);
}

const WEB_URL = () => process.env.WEB_URL ?? 'http://localhost:3020';
/** Emails are jobs; the worker delivers them. Links point at the web app. */
export const email = {
  verify: (to, token) => ({ to, subject: 'Confirm your email for Vyralink', text: `Confirm your email: ${WEB_URL()}/verify-email?token=${token}\nThe link expires in 24 hours.` }),
  exists: (to) => ({ to, subject: 'Someone tried to sign up with your email', text: `An account already uses this email. If that was you, sign in or reset your password: ${WEB_URL()}/forgot-password` }),
  reset: (to, token) => ({ to, subject: 'Reset your Vyralink password', text: `Reset your password: ${WEB_URL()}/reset-password?token=${token}\nThe link expires in 1 hour. If you didn’t ask for this, ignore this email.` }),
  invite: (to, token, org, role) => ({ to, subject: `You’re invited to ${org} on Vyralink`, text: `You’ve been invited to ${org} as ${role.replace(/_/g, ' ')}: ${WEB_URL()}/invite?token=${token}\nThe invitation expires in 7 days.` }),
};

/** Development email transport: one JSON file per message (real provider blocked until an account exists). */
export function devMailTransport(dir = process.env.DEV_MAIL_DIR ?? path.resolve(process.cwd(), '.dev-mail')) {
  return async (msg) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify(msg, null, 2));
  };
}

/** Claims and runs up to `limit` due jobs. Failures retry with exponential backoff; sent emails have their links scrubbed. */
export async function runDueJobs(pool, handlers, limit = 20) {
  const { rows: jobs } = await pool.query(
    `UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
     WHERE id IN (SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now() ORDER BY run_at LIMIT $1 FOR UPDATE SKIP LOCKED) RETURNING *`, [limit]);
  for (const j of jobs) {
    try {
      const h = handlers[j.kind];
      if (!h) throw new Error(`no handler for ${j.kind}`);
      await h(j.payload);
      await pool.query(`UPDATE jobs SET status = 'done', done_at = now(), last_error = NULL, payload = CASE WHEN kind = 'email' THEN jsonb_build_object('to', payload->'to', 'subject', payload->'subject') ELSE payload END WHERE id = $1`, [j.id]);
    } catch (err) {
      const dead = j.attempts >= j.max_attempts;
      await pool.query(`UPDATE jobs SET status = $2, last_error = $3, run_at = now() + make_interval(secs => $4) WHERE id = $1`, [j.id, dead ? 'failed' : 'queued', String(err.message).slice(0, 500), 2 ** j.attempts * 10]);
    }
  }
  return jobs.length;
}
