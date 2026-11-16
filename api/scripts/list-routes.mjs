// Prints every API route (no database needed). Usage: node scripts/list-routes.mjs
import { buildApp } from '../src/app.js';

const routes = [];
const app = buildApp({ pool: { query: async () => ({ rows: [] }) } });
app.addHook('onRoute', (r) => { if (![].concat(r.method).every((m) => ['HEAD', 'OPTIONS'].includes(m))) routes.push(`${[].concat(r.method).filter((m) => m !== 'HEAD').join(',')} ${r.url}`); });
await app.ready();
console.log(routes.join('\n'));
