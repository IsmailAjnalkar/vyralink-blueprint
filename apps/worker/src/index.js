// Vyralink worker: claims due jobs (FOR UPDATE SKIP LOCKED, so several workers can run), writes a heartbeat,
// and stops cleanly on SIGINT/SIGTERM. Email goes to the dev outbox until a real provider is configured.
import os from 'node:os';
import { createPool } from '@vyralink/api/src/db.js';
import { devMailTransport, runDueJobs } from '@vyralink/api/src/jobs.js';

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 1000);
const workerId = `${os.hostname()}:${process.pid}`;

function emailTransport() {
  const provider = process.env.EMAIL_PROVIDER ?? 'dev';
  if (provider === 'dev') return devMailTransport();
  // Blocked: no email provider account yet. Refuse to start rather than silently dropping mail.
  throw new Error(`EMAIL_PROVIDER=${provider} is not configured in this build`);
}

const pool = createPool();
const handlers = { email: emailTransport() };
let stopping = false;
const log = (msg, extra = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), workerId, msg, ...extra }));

async function tick() {
  await pool.query('INSERT INTO worker_heartbeats (worker_id, seen_at) VALUES ($1, now()) ON CONFLICT (worker_id) DO UPDATE SET seen_at = now()', [workerId]);
  const n = await runDueJobs(pool, handlers);
  if (n) log('ran jobs', { count: n });
}

log('worker started', { email: process.env.EMAIL_PROVIDER ?? 'dev' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopping = true; });
while (!stopping) {
  try { await tick(); } catch (err) { log('tick failed', { error: err.message }); }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
await pool.query('DELETE FROM worker_heartbeats WHERE worker_id = $1', [workerId]).catch(() => {});
await pool.end();
log('worker stopped');
