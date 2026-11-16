# Project audit

Date: 2026-11-16. Branch: `platform` (from `main` at `f4c444e`).

## What exists

| Area | State | Evidence |
|---|---|---|
| Blueprint (design) | Complete for Phase A | `project/` canvas: 90 wireframed screens, 21 flowcharts, 25 edge cases, handoff JSON/CSV |
| Blueprint generators | Working | `scripts/gen*.mjs` regenerate `project/` |
| Backend API | Working (MVP scope) | `api/`: Fastify 5 + PostgreSQL, 123 endpoints, `npm test` → 10/10 pass |
| Database | Working | `api/src/schema.sql`: 30 tables, exclusion constraints against double booking, partial unique indexes on ledger/invoices |
| Security review | Two automated reviews, 15 findings fixed | commits `85d27d6`, `f4c444e` |
| Frontend web app | Missing | no `apps/web` |
| Background worker | Missing | notifications are written to a table; nothing delivers email |
| CI/CD | Missing | no `.github/workflows` |
| Containers | Missing | no Dockerfile / compose |
| OpenAPI | Missing | routes have JSON schemas but no generated spec |

## Stack found

Node 24, npm workspaces not yet used, Fastify 5.12, `pg` 8, embedded Postgres 18 for development, Node's built-in test runner. API code is JavaScript (ESM), not TypeScript.

## Authentication and permissions (as found)

- Bearer-token sessions stored hashed in `sessions`; scrypt password hashing.
- Organization context by `x-org-id`; roles checked on the server in every route; suspended organizations refused in `onRequest`.
- Missing: browser cookie sessions and CSRF protection, email verification, password reset, MFA, rate limiting / lockout, invitations by email, Platform Support Admin and Brand Finance roles.

## Payments and integrations (as found)

- Payment provider, identity provider and payout onboarding are simulated by admin endpoints.
- TikTok Shop: manual CSV import of order and refund reports. No API connection; no official access available in this environment.

## Tests (executed)

`cd api && npm test` → 10 tests, 10 pass (7 money unit tests, GlowSkin end-to-end, permissions, suspension).

## Build and deployment blockers

1. No frontend: every portal screen is still a wireframe.
2. No Docker / CI / staging environment.
3. External accounts not available: Stripe, TikTok Shop partner access, email provider, S3-compatible storage, Sentry. Each integration must stay sandboxed or manual until credentials and approvals exist.
4. API is JavaScript; the brief asks for strict TypeScript.
