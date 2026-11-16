import { buildApp } from './app.js';
import { createPool, migrate } from './db.js';
import { assertProductionReady, integrations } from './providers.js';

assertProductionReady(); // production refuses simulated payments, dev email, local files and demo orders
const pool = createPool();
await migrate(pool);
const app = buildApp({ pool, logger: true });
app.log.info({ integrations: integrations().map((i) => `${i.name}=${i.provider} (${i.status})`) }, 'integrations');
await app.listen({ port: Number(process.env.PORT ?? 4020), host: process.env.HOST ?? '127.0.0.1' });
