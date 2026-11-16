# Deployment

**Current state:** runs locally and as a Docker Compose stack (verified on Docker 29 / Compose v5). **No staging or production environment exists, and nothing has been deployed.** Every deployment needs explicit approval. The API refuses `NODE_ENV=production` until real payment, email, storage and orders providers are connected (see Integrations).

## Run with Docker Compose (staging-like, one machine)

```
cp .env.example .env          # set POSTGRES_PASSWORD, APP_SECRET, ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up -d --build
open http://localhost:3030     # WEB_PORT
```

| Service | Image | Reachable from | Notes |
|---|---|---|---|
| `edge` | caddy:2-alpine | host :3030 (http), :8443 (https; 443 in production) | Sets `X-Forwarded-For` from the real connection; automatic TLS when `SITE_ADDRESS` is a domain; flushes server-sent events immediately |
| `web` | vyralink-web (Next.js standalone, 304 MB) | edge only | Same-origin `/api` proxy; never expose it directly |
| `api` | vyralink-api (266 MB) | web and worker only | Applies migrations on start; `/v1/health`, `/v1/health/ready` (database + worker heartbeat) |
| `worker` | vyralink-worker (266 MB) | — | Email outbox and scheduled jobs from the Postgres job table |
| `postgres` | postgres:18-alpine | api and worker only | Volume `pgdata` |

All application containers run as the unprivileged `node` user with production dependencies only. Verified in the container run: the health and readiness checks pass; sign-up → worker email → verify → signed-in session works through the edge; cross-site POSTs are refused; a forged `X-Forwarded-For` is ignored (the session records the real peer); the web app is not reachable except through the edge.

Production checklist for the same stack:
- `SITE_ADDRESS=app.example.com`, `WEB_URL=https://app.example.com`, `WEB_ORIGINS=https://app.example.com`, `COOKIE_SECURE=true`, `HTTPS_PORT=443`.
- Real providers configured (below); then the API can run with `NODE_ENV=production`.
- Managed Postgres (or this container with backups below), and the `storage` volume backed up or replaced by S3.

## Backups and restore drill

```
sh deploy/backup.sh ./backups                      # pg_dump -Fc of the live database
sh deploy/restore-drill.sh ./backups/<file>.dump   # restores into a scratch database, compares every table's row count
```

Run `backup.sh` nightly (cron or a scheduled job) and copy the files off the machine. The restore drill was run against the compose stack: 38 tables matched. Uploaded files are in the `storage` volume: back it up on the same schedule.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:
- type checks (API and web);
- lint;
- `npm audit --omit=dev`;
- API tests against a Postgres 18 service;
- the GlowSkin browser test (Chromium, with the axe accessibility sweep);
- builds of the three Docker images.

It deploys nothing. Each step was run locally with the same commands; the workflow has not yet run on GitHub because the branch hasn't been pushed.

## Local development

```
npm install
npm run db:start                # embedded PostgreSQL on 127.0.0.1:5441
npm run dev:api                 # API  http://127.0.0.1:4020/v1   (TRUSTED_PROXIES=loopback when used behind the web app)
npm start -w @vyralink/worker   # jobs + email outbox (.dev-mail/)
npm run dev:web                 # web  http://localhost:3020
```

## Integrations (one switch each)

| Variable | Values | Today |
|---|---|---|
| `PAYMENTS_PROVIDER` | `sandbox` (default) · `stripe` | sandbox. Stripe adapter not built: no account |
| `EMAIL_PROVIDER` | `dev` (default, writes `DEV_MAIL_DIR`) · `smtp` | dev. No email provider account |
| `STORAGE_PROVIDER` | `local` (default, `STORAGE_DIR`, default `.storage`) · `s3` | local. No bucket |
| `ORDERS_PROVIDER` | `csv` (default) · `sandbox` (development/test demo orders) · `tiktok_shop` | csv. No TikTok Shop partner access |

The API logs the active providers at startup and **refuses to start with `NODE_ENV=production`** while any of them is sandbox, dev or blocked. The admin console shows the same table (Review queue → Integrations).

## Client IP, proxies and CSRF

| Variable | Service | Value |
|---|---|---|
| `TRUSTED_PROXIES` | API | Addresses allowed to set `X-Forwarded-For`: the web app (plus any load balancer in front of the API), as IPs, CIDRs or `loopback` / `uniquelocal`. Compose: `uniquelocal`. A hop count does **not** work: Fastify 5 treats a number as "trust nothing" (`test/proxy.test.js`). |
| `TRUSTED_PROXY_HOPS` | web | Extra trusted proxies in front of the edge (`0` by default). Next.js keeps an incoming `X-Forwarded-For` as-is, so the web app must only be reachable through the edge proxy, which replaces the header. |
| `WEB_ORIGINS` | web | Allowed `Origin` values for state-changing requests (e.g. `https://app.example.com`). Empty: compared with the `Host` header (works behind Docker and load balancers). |

History: two IP-handling defects were found and fixed. Phase 8: `TRUST_PROXY_HOPS=1` was silently ignored by the API. Phase 9: the standalone web server passed a client-written header through. The Phase 1 check missed both because they masked each other. The current setup is verified in the container run above.

## Required secrets and accounts

| Secret | For | Status |
|---|---|---|
| `POSTGRES_PASSWORD` / `DATABASE_URL` | PostgreSQL | set in `.env` (compose) |
| `APP_SECRET` | sealing MFA secrets (AES-256-GCM); required in production | set in `.env` |
| Email provider key | verification, reset, notifications | **Blocked**: no account (dev writes to an outbox folder) |
| Stripe keys + `PAYMENTS_WEBHOOK_SECRET` | brand billing, payouts; webhook at `POST /v1/webhooks/payments` | **Blocked**: no account. The handler verifies Stripe-style signatures and de-duplicates event ids. The event-to-record mapping (metadata `invoice_id` / `payout_id`; `payment_intent.*`, `transfer.*`) must be confirmed against the real Stripe setup before go-live |
| TikTok Shop partner app credentials | order sync | **Blocked**: no approved access (CSV import works) |
| S3-compatible storage | product images, documents | **Blocked**: no bucket (local volume works on one machine) |
| Error monitoring (e.g. Sentry DSN) | production errors | not set up (logs are JSON on stdout) |

## End-to-end tests (local)

```
npm run db:start
npm run build -w @vyralink/web
npm run test:e2e        # API :4120 + web :3120 on a fresh vyralink_e2e database (E2E_DATABASE_URL to override)
```

Uses the system Microsoft Edge on Windows (`PW_CHANNEL=msedge`); elsewhere run `npx playwright install chromium` first.
