import { buildApp } from './app.js';
import { createPool, migrate } from './db.js';

const pool = createPool();
await migrate(pool);
const app = buildApp({ pool, logger: true });
await app.listen({ port: Number(process.env.PORT ?? 4020), host: '127.0.0.1' });
