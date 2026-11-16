# Deployment

**Current state:** local development only. No staging or production environment exists. Nothing is deployed automatically; every deployment needs explicit approval.

## Local

```
npm install
npm run db:start -w apps/api
npm run migrate -w apps/api
npm run dev:api        # API  http://127.0.0.1:4020/v1
npm start -w @vyralink/worker   # jobs + email outbox (.dev-mail/)
npm run dev:web        # web  http://localhost:3020
```

## Planned (Phase 9)

- Dockerfiles for api, web, worker; `docker-compose.yml` with PostgreSQL.
- GitHub Actions: install, lint, typecheck, unit + integration tests, `npm audit`, build, E2E smoke.
- Health `/v1/health`, readiness `/v1/health/ready` (database + worker heartbeat).
- Backups: nightly `pg_dump`, restore drill documented.

## Required secrets and accounts (none available yet)

| Secret | For | Status |
|---|---|---|
| `DATABASE_URL` | PostgreSQL | local only |
| `SESSION_SECRET` / `COOKIE_SECURE` | cookies | local defaults |
| Email provider key | verification, reset, notifications | Blocked: no account (dev writes to an outbox folder) |
| Stripe keys + webhook secret | brand billing, payouts | Blocked: no account |
| TikTok Shop partner app credentials | order sync | Blocked: no approved access (CSV import works) |
| S3-compatible storage | product images, documents | Blocked: no bucket |
| Sentry DSN | error monitoring | optional |
