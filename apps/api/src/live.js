// Fan-out of Postgres 'live' notifications (see migrations/004_live_notify.sql) to in-process subscribers.
// One dedicated connection per API process, opened on the first subscriber.
// ponytail: per-process LISTEN; several API instances each LISTEN on their own, which is fine for Postgres.
import { EventEmitter } from 'node:events';

export function liveHub(pool) {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  let client = null;
  let connecting = null;

  async function connect() {
    client = await pool.connect();
    client.on('notification', (n) => bus.emit(n.payload));
    client.on('error', () => { client?.release(true); client = null; connecting = null; }); // next subscriber reconnects
    await client.query('LISTEN live');
  }

  return {
    /** Calls fn(locationId) whenever that location changes. Returns an unsubscribe function. */
    async subscribe(locationId, fn) {
      if (!client) await (connecting ??= connect());
      bus.on(locationId, fn);
      return () => bus.off(locationId, fn);
    },
    async close() {
      if (client) { client.release(true); client = null; } // destroy, never hand a LISTENing connection back to the pool
    },
  };
}
