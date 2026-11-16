# Vyralink + Creator Hub — MVP API

The backend for the blueprint in `../project`: every MVP area across brand, seller, Creator Hub operations, finance and admin. Node 22+, Fastify 5, Postgres (embedded for development). No other dependencies.

## Run

```
npm install
npm run db:start                     # local Postgres on 127.0.0.1:5441 (no Docker)
ADMIN_EMAIL=admin@vyralink.local ADMIN_PASSWORD='…' npm run migrate   # schema + optional super admin
npm start                            # http://127.0.0.1:4020
npm test                             # money unit tests + full GlowSkin flow against a fresh test database
node scripts/list-routes.mjs         # all 123 endpoints
```

On Windows PowerShell set the variables first: `$env:ADMIN_EMAIL='…'; $env:ADMIN_PASSWORD='…'; npm run migrate`.

## Conventions

- **Auth:** `POST /auth/login` returns a token; send `Authorization: Bearer <token>`.
- **Organization context:** send `x-org-id: <org uuid>` for brand and Creator Hub endpoints. Roles are checked on the server for every request.
- **Money:** integer cents. Rates: basis points (`500` = 5%).
- **Data sources** are returned with live numbers: `Manual` (producer entry), `Imported` (TikTok Shop report), `Verified` (studio log), `Delayed`, `Unavailable`. Missing data is `null`, never 0.
- **Errors:** `{ error, code }` with HTTP 400 / 401 / 403 / 404 / 409. Business-rule codes include `brand_not_verified`, `product_not_approved`, `overlap`, `hold_expired`, `seller_not_verified`, `training_missing`, `not_ready`, `returns_window_open`, `same_approver`, `last_owner`.
- **Statuses** follow the blueprint’s lists (`src/status.js`); invalid moves return 409 `invalid_transition`.

## Money rules (`src/money.js`, `src/settle.js`)

- One base for everything: **eligible attributable sales** = orders the TikTok Shop report attributes to the LIVE, minus refunds and cancellations.
- Seller: base pay = agreed rate × studio-log hours (locked at closeout); commission and bonus are provisional until the returns window closes, then locked.
- Brand: production fee invoiced at closeout; performance fee drafted at import and issued at lock.
- After lock, refunds never edit locked lines: they create ledger adjustments and credit notes.
- GMV is brand sales and never counted as revenue. Seller pay is a Creator Hub expense. No escrow.
- Producer entries during the LIVE are monitoring only, never a pay or fee basis.

The tests reproduce the blueprint example: $6,000 GMV, 4 refunds → eligible $5,840 → commission $292, bonus $100, base $90, performance fee $408.80.

## Endpoints

| Area | Endpoints |
|---|---|
| Auth and account | All under `/v1`. `POST /auth/signup` (202, same answer for taken emails) · `POST /auth/verify-email` · `POST /auth/resend-verification` · `POST /auth/login` (lockout; returns `mfaRequired` + pending token when MFA is on) · `POST /auth/mfa/verify` · `POST /auth/mfa/setup` · `POST /auth/mfa/enable` · `POST /auth/password-reset` · `POST /auth/password-reset/confirm` · `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/logout` · `POST /auth/logout-all` · `GET /me` · `POST/GET /orgs/current/invitations` · `POST /invitations/preview` · `POST /invitations/accept` · `GET /openapi.json` · `GET /health` · `GET /health/ready` |
| Organization | `GET /orgs/current` · `GET/POST /orgs/current/members` · `PATCH/DELETE /orgs/current/members/:userId` · `GET/POST /orgs/current/verification` |
| Seller | `GET/PUT /seller/profile` · `GET /academy/courses` · `GET/POST /academy/:course/assessment` (server-graded answers; 24 h retake wait) · `GET /seller/invitations` · `GET /seller/earnings` · `GET /seller/payouts` · `GET /jobs` · `POST /jobs/:campaignId/apply` |
| Discovery | `GET /sellers` (filters: category, language, minGmvPerHourCents, verifiedOnly) · `GET /sellers/:id` |
| Products | `POST/GET /products` · `GET/PATCH /products/:id` · `POST /products/:id/submit` · `POST /products/:id/archive` |
| Campaigns | `POST/GET /campaigns` · `GET/PATCH /campaigns/:id` · `POST /campaigns/:id/publish` · `/approve` · `/decline` · `/cancel` (quote, then confirm) · `/hold` · `GET /campaigns/:id/report` |
| Invitations and contracts | `POST/GET /campaigns/:id/invitations` · `POST /invitations/:id/view` · `/accept` · `/decline` · `/counter` · `/respond` · `/accept-application` · `/withdraw` · `GET /contracts/:id` · `POST /contracts/:id/sign` |
| Messages and notifications | `GET/POST /campaigns/:id/messages` (contact details masked) · `GET /notifications` · `POST /notifications/:id/read` |
| Studio | `POST/GET /locations` · `PATCH /locations/:id` · `POST/GET /locations/:id/booths` · `PATCH /booths/:id` · `GET /locations/:id/availability` · `GET /locations/:id/control-center` · `GET /locations/:id/today` · `POST/GET /locations/:id/equipment` · `PATCH /equipment/:id` |
| Bookings and LIVE day | `GET /bookings` · `GET /bookings/:id` · `POST /bookings/:id/assign-producer` · `/confirm` · `/move` (Location Manager: another booth, same time) · `/reschedule` (Brand Owner: a hold, before any contract states the time) · `GET /seller/bookings` (seller's sessions, check-in code, briefing) · `/check-in` · `/no-show` · `GET /bookings/:id/readiness` · `POST /bookings/:id/briefing/acknowledge` · `POST /bookings/:id/readiness/:item` · `/go` · `/start` · `/metrics` · `/incidents` · `GET /incidents` · `PATCH /incidents/:id` · `POST /bookings/:id/closeout` |
| Samples | `POST/GET /bookings/:id/shipments` · `POST /shipments/:id/receive` · `POST/GET /bookings/:id/samples` |
| Results and finance | `POST /bookings/:id/results` (order CSV) · `POST /bookings/:id/refunds` (refund CSV) · `GET /bookings/:id/settlement` · `POST /bookings/:id/lock` · `GET /finance/overview` |
| Invoices | `GET /invoices` · `GET /invoices/:id` · `POST /invoices/:id/paid` · `/payment-failed` · `/credit-note` · `POST /invoices/sweep-overdue` |
| Ledger and payouts | `GET /ledger` · `POST /ledger/adjustments` (over $100: pending until `POST /ledger/adjustments/:id/approve` by a different person) · `POST /payout-runs` · `POST /payout-runs/:id/approve` · `/execute` · `POST /payouts/:id/retry` |
| Disputes | `POST/GET /disputes` · `GET /disputes/:id` · `POST /disputes/:id/evidence` · `/decide` |
| Admin | `GET /admin/verifications` · `POST /admin/verifications/:id/decision` · `GET /admin/products` · `POST /admin/products/:id/decision` · `POST/GET /admin/orgs` · `POST /admin/orgs/:id/members` · `/suspend` · `GET /admin/users` · `POST /admin/users/:id/lock` · `POST /admin/sellers/:id/provider-status` · `GET/PUT /admin/flags` · `GET/PUT /admin/settings` · `GET /admin/audit` |

## Security rules

- Academy checks are graded on the server; the answer key never leaves it.
- A suspended organization is read-only for all its members.
- Finance records (invoices, ledger, payouts, disputes) are scoped to the Creator Hub organization that ran the booking.
- Two-person control: large ledger adjustments and large payout runs need a second person approving with their own login.
- Payout runs are serialized per organization and lock the ledger lines they claim, so a line can't be paid twice.
- A brand’s dispute holds at most the seller’s unpaid pay for that session; one open dispute per session and type; disputes close 7 days after lock.
- A fully signed booking can’t be replaced by another acceptance.
- Error responses carry no database detail; sign-up, resend and password reset answer the same whether or not the email has an account.
- Email must be verified before sign-in. 5 failed sign-ins lock the account for 15 minutes; auth routes are rate-limited per IP.
- Platform admins, support admins and finance administrators must enroll in TOTP MFA; their sessions need the second factor. Secrets are encrypted at rest (AES-256-GCM, `APP_SECRET`).
- Password reset signs out every session. Members join only by email invitation accepted with the invited account.

## Simulated in development

- **Payment provider:** `POST /invoices/:id/paid` and `POST /payout-runs/:id/execute` stand in for provider webhooks (`failSellerIds` simulates failures).
- **Identity and payout verification:** `POST /admin/sellers/:id/provider-status` stands in for the identity provider and payout onboarding.
- **Documents:** verification stores document metadata (type, file name), not files.

## Not built yet

- Phase 2/3 features (TikTok Shop API sync, AI matching, retainers, instant payouts, multi-location reports, profitability, expenses). Their feature flags exist in `/admin/flags`.
- Rescheduling a booking in place (cancel and re-hold instead); the 24-hour wait before retaking an assessment.
- Real payment, identity and file-storage integrations.

## Settings to decide

`GET /admin/settings`. These defaults stand in for blueprint placeholders: `returns_window_days` (30), `payout_two_approval_cents` ($5,000). Also configurable: approval threshold ($1,000), invitation expiry (48 h), adjustment approval ($100), invoice terms (15 days), default commission (5%), performance fee (7%).
