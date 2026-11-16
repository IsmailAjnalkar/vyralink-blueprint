// Fan-out of Postgres 'live' notifications (see migrations/004_live_notify.sql) to in-process subscribers.
// One dedicated connection per API process, opened on the first subscriber and re-opened after a failure.
// ponytail: per-process LISTEN; several API instances each LISTEN on their own, which is fine for Postgres.
import { EventEmitter } from 'node:events';

export function liveHub(pool) {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  let client = null;
  let connecting = null;

  async function connect() {
    const c = await pool.connect();
    c.on('notification', (n) => bus.emit(n.payload));
    c.on('error', () => {
      // Drop the broken connection (never back into the pool) and re-LISTEN for the subscribers still waiting.
      c.release(true);
      if (client === c) client = null;
      connecting = null;
      if (bus.eventNames().length) setTimeout(() => ensure().catch(() => {}), 1000);
    });
    await c.query('LISTEN live');
    client = c;
  }
  const ensure = () => {
    if (client) return Promise.resolve();
    connecting ??= connect().finally(() => { connecting = null; });
    return connecting;
  };

  return {
    /** Calls fn(locationId) whenever that location changes. Returns an unsubscribe function. Throws if Postgres is unreachable. */
    async subscribe(locationId, fn) {
      await ensure();
      bus.on(locationId, fn);
      return () => bus.off(locationId, fn);
    },
    async close() {
      if (client) { client.release(true); client = null; } // destroy, never hand a LISTENing connection back to the pool
    },
  };
}
