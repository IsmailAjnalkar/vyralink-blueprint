# Architecture

A modular monolith in one npm-workspaces repository.

```
apps/api      Fastify 5 REST API (/v1), PostgreSQL via pg, SQL schema
apps/web      Next.js (App Router, TypeScript, Tailwind, shadcn/ui): brand, creator, Creator Hub, admin portals
apps/worker   Background jobs (email, reminders, overdue sweeps) from a PostgreSQL job table
docs/         audit, plan, specs
project/      design blueprint (canvas files)
scripts/      blueprint generators
```

The web app calls the API through its own `/api/*` route handler (same origin), so the browser holds only an httpOnly session cookie.

## Decisions that differ from the preferred stack

The brief allows an existing working architecture when it is justified. These were kept or chosen on purpose:

| Preferred | Chosen | Why |
|---|---|---|
| NestJS | **Fastify 5** (existing) | 123 working, tested, security-reviewed endpoints. NestJS runs on Fastify anyway; a rewrite adds risk without new capability. |
| Prisma | **SQL schema + `pg`** | Core guarantees are database features Prisma can't express: `EXCLUDE USING gist` (no double booking), partial unique indexes (one ledger line per kind), advisory locks (payout runs). |
| BullMQ + Redis | **PostgreSQL job table (`FOR UPDATE SKIP LOCKED`)** | Jobs are enqueued in the same transaction as the business change (transactional outbox), so an email is never sent for a rolled-back payment. One less service to run and secure. Revisit if job volume needs it. |
| Redis cache | None yet | No measured need. Add when a query is shown to be slow. |
| TypeScript everywhere | Web: strict TypeScript. API: JavaScript today | Converting the API is planned (Phase 8); until then the API is covered by integration tests and JSON-schema validation on every route. |

## Core rules (enforced in the database or server)

- **Tenancy:** every brand/operator route checks the member's organization and role on the server; finance records are scoped to the operator that ran the booking.
- **No double booking:** exclusion constraints on booth, producer and seller time ranges (including setup/teardown buffers).
- **Money:** integer cents, basis-point rates, explicit currency; ledger lines are append-only and corrected with adjustment lines.
- **No escrow:** brand charges and seller payouts are separate payment-provider flows; customer purchases stay in TikTok Shop.
- **External data:** never invented. TikTok Shop data arrives by authorized CSV import (MVP) until an official integration is approved.

## Authentication

Server-side sessions (hashed tokens in PostgreSQL). Browser: httpOnly, SameSite=Lax cookie set by the web app; state-changing requests checked for same-origin. API clients: `Authorization: Bearer`. Passwords: scrypt. MFA (TOTP) for platform admins and finance administrators.
