# Implementation plan

Each phase ends with: run the app, run the tests, fix defects, record results here, commit.

| Phase | Scope | Status |
|---|---|---|
| 0 | Audit and architecture docs | Done |
| 1 | Monorepo, `/v1` API, OpenAPI, email verification, password reset, rate limiting and lockout, session revocation, org invitations, MFA for privileged users, Platform Support Admin and Brand Finance roles, worker with email outbox | **Done.** API 25/25 tests; web: typecheck clean, lint 0 errors, production build OK; proxy smoke test (CSRF refused, sign-up → outbox → verify → httpOnly cookie → /app) passed. 4 security reviews, all findings fixed |
| 2 | Marketplace screens: brand onboarding, products, campaign wizard, creator discovery, invitations/applications, creator portal | **Done.** 12 screens (verification, products, product detail, campaign list, 6-step wizard, campaign page with booth hold/invitations/counter/cancel quote, discovery + compare, contract signing, seller profile, academy, jobs + invitations, earnings, admin review queue). Playwright E2E `npm run test:e2e`: 7/7 through the UI on a fresh database; it caught and we fixed 3 defects (server/client import crash on Overview, empty optional profile fields rejected, invitation kind mismatch hid Accept). API 25/25; typecheck, lint (0 errors), build OK |
| 3 | Studio operations screens: locations, booths, booking calendar, rescheduling, inventory, check-in | Not started (API exists) |
| 4 | LIVE operations: control center with server-sent events, readiness, incidents, closeout | Not started (API exists) |
| 5 | Finance: currency columns, invoices/ledger/payout screens, exports, idempotent webhook handling | Not started (API exists) |
| 6 | Integrations: commerce provider interface, TikTok Shop sandbox adapter + CSV import, Stripe adapter (sandbox), storage adapter | Not started |
| 7 | Analytics dashboards and rules-based matching with explanations | Not started |
| 8 | Playwright E2E (GlowSkin through the UI), security tests, accessibility, performance, API → TypeScript | Not started |
| 9 | Docker, compose, CI, health/readiness, logging, backups, staging guide | Not started |

## Checkpoints

Progress is committed on branch `platform` after each verified step; this table is updated with the evidence.
