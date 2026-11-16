// What this app adds to Fastify's request and instance (set in app.js), for the TypeScript checker.
import 'fastify';
import type { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string; name: string; is_super_admin: boolean; is_support_admin: boolean; email_verified_at: Date | null; mfa_enabled: boolean } | null;
    session: { id: string; mfaPassed: boolean } | null;
    membership: { orgId: string; role: string; kind: 'brand' | 'operator'; orgStatus: string } | null;
    pendingMfa?: { sessionId: string; userId: string };
  }
  interface FastifyInstance {
    pool: Pool;
    live: { subscribe(locationId: string, fn: () => void): Promise<() => void>; close(): Promise<void> };
    rateLimitScale: number;
  }
}
