# Test strategy

| Layer | Tool | Runs | Covers |
|---|---|---|---|
| Unit | `node:test` (API), Vitest (web) | every commit | money rules, status transitions, grading, matching rules |
| Integration | `node:test` + Fastify `inject` + a fresh PostgreSQL database per run | every commit | every route group, tenancy, booking conflicts, ledger, payouts, disputes |
| End to end | Playwright | every commit (CI) | GlowSkin scenario through the web UI |
| Security | integration tests | every commit | cross-tenant reads/writes, privilege escalation, invalid/expired tokens, CSRF, rate limits, webhook replay, injection payloads |
| Performance | scripted load (autocannon) | before release | concurrent booking holds, search, dashboards |

## Thresholds (local development hardware; re-measure on staging)

- Concurrent booking: 50 simultaneous holds for the same booth and slot → exactly 1 succeeds, 49 receive 409.
- API p95 latency under 300 ms for dashboard and search endpoints with 10,000 campaigns and 1,000 sellers.
- GlowSkin E2E completes in under 2 minutes.

## Rules

Results are recorded only from executed commands. A failing or skipped test is reported as such.
