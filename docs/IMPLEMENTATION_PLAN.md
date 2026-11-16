# Implementation plan

Each phase ends with: run the app, run the tests, fix defects, record results here, commit.

| Phase | Scope | Status |
|---|---|---|
| 0 | Audit and architecture docs | Done |
| 1 | Monorepo, `/v1` API, OpenAPI, email verification, password reset, rate limiting and lockout, session revocation, org invitations, MFA for privileged users, Platform Support Admin and Brand Finance roles, worker with email outbox | **Done.** API 25/25 tests; web: typecheck clean, lint 0 errors, production build OK; proxy smoke test (CSRF refused, sign-up → outbox → verify → httpOnly cookie → /app) passed. 4 security reviews, all findings fixed |
| 2 | Marketplace screens: brand onboarding, products, campaign wizard, creator discovery, invitations/applications, creator portal | **Done.** 12 screens (verification, products, product detail, campaign list, 6-step wizard, campaign page with booth hold/invitations/counter/cancel quote, discovery + compare, contract signing, seller profile, academy, jobs + invitations, earnings, admin review queue). Playwright E2E `npm run test:e2e`: 7/7 through the UI on a fresh database; it caught and we fixed 3 defects (server/client import crash on Overview, empty optional profile fields rejected, invitation kind mismatch hid Accept). API 25/25; typecheck, lint (0 errors), build OK |
| 3 | Studio operations screens: locations, booths, booking calendar, rescheduling, inventory, check-in | **Done.** Screens: studio Today board, bookings list, booking page (producer, confirm, move booth, front-desk check-in, readiness + Go with audited override, sample receipt and movements, no-show), locations/booths/equipment; brand sample shipments and hold rescheduling; seller "My sessions" (code, arrival, briefing); admin creates Creator Hub orgs. New API: move, reschedule, seller bookings (covered in flow test). E2E GlowSkin 10/10 through the UI (Creator Hub now set up in the UI too). API 25/25 |
| 4 | LIVE operations: control center with server-sent events, readiness, incidents, closeout | **Done.** Postgres triggers NOTIFY on booking/metric/incident/readiness changes; `GET /locations/:id/control-center/stream` pushes the board (session, lock and role re-checked every 30 s). Screens: LIVE control center (start, manual numbers with source labels, incidents, emergency stop, resolve, closeout), results/refunds CSV import with settlement, brand results card, notifications page with unread count. API 25/25 (stream asserted); E2E 13/13 incl. a second browser seeing pushes without reload |
| 5 | Finance: currency columns, invoices/ledger/payout screens, exports, idempotent webhook handling | **Done.** `currency` (USD-only CHECK) on every money table; `POST /webhooks/payments` (Stripe-style HMAC signature, 5-min tolerance, event-id dedupe, amount+currency must match); role-scoped CSV exports with formula-injection guard; payout-run list/detail. Screens: finance overview + lock queue, invoices (sandbox paid/failed, credit notes, overdue sweep), seller ledger + two-person approvals (location managers see pending only), payout runs (build/approve/send sandbox/retry), disputes queue + detail (evidence, admin decision), brand billing + campaign report + disputes, seller payouts + pay disputes, admin settings. API 25/25; E2E GlowSkin 17/17 through payout |
| 6 | Integrations: commerce provider interface, TikTok Shop sandbox adapter + CSV import, Stripe adapter (sandbox), storage adapter | Not started |
| 7 | Analytics dashboards and rules-based matching with explanations | Not started |
| 8 | Playwright E2E (GlowSkin through the UI), security tests, accessibility, performance, API → TypeScript | Not started |
| 9 | Docker, compose, CI, health/readiness, logging, backups, staging guide | Not started |

## Checkpoints

Progress is committed on branch `platform` after each verified step; this table is updated with the evidence.
