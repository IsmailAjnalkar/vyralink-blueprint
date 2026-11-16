# Security checklist

| Control | Status | Evidence / plan |
|---|---|---|
| Password hashing (scrypt) | Done | `http.js` hashPassword |
| Session tokens hashed at rest | Done | `sessions.token_hash` |
| Server-side RBAC + organization checks | Done | `member()`, per-route roles; permission tests |
| Tenant isolation for finance records | Done | `OWNS(...)` scoping in finance routes |
| Suspended organizations read-only | Done | `onRequest` gate; test |
| Input validation on every route | Done | JSON schemas, `additionalProperties: false` |
| SQL injection | Done | parameterized queries only |
| No DB detail in errors | Done | error handler |
| Two-person control (adjustments, payout runs) | Done | tests |
| Double-booking prevention in DB | Done | exclusion constraints; test |
| Audit log for critical actions | Done | `audit_log` |
| Secure cookies + CSRF | Done | httpOnly SameSite=Lax cookie (Secure when `COOKIE_SECURE=true`); proxy refuses cross-origin writes (smoke-tested) |
| Email verification / password reset | Done | `auth.test.js` |
| MFA for privileged users | Done | TOTP; `auth.test.js`, flow test enrollment gate |
| Rate limiting / lockout | Done | `auth.test.js` |
| Session revocation | Done | `auth.test.js` |
| Security headers (CSP, HSTS) | Done | `next.config.ts`; HSTS when served over HTTPS |
| Secure file uploads | Done | type from magic bytes, size limits, role checks, per-org quota, nosniff + sandbox CSP on download, documents readable by Brand Owners and platform staff only |
| Webhook signature + replay protection | Done | HMAC (timing-safe), 5-min tolerance, event-id dedupe in the same transaction, amount+currency must match |
| Secrets outside source | Done | env vars; no secrets committed |
| Dependency scanning | Done locally | `npm audit --omit=dev`: 0. Dev-only: 6 low/moderate in the shadcn CLI (code generator, not shipped). CI job in Phase 9 |
| Data retention / account deletion | Missing | Phase 8 |

## Phase 8 independent review (fixed)

| Finding | Severity | Fix | Test |
|---|---|---|---|
| Re-importing refunds after lock could raise pay and bill the brand | Medium | finance-only after lock; refunds only grow; increases refused | flow.test.js |
| Two-person rule bypass (non-MFA approver, self-approved runs, stacked small adjustments) | Medium | MFA for every approver; builder can't approve a run; 24 h stacking cap | flow.test.js |
| Live stream could exhaust the database pool | Medium | 3 streams/session, 500/process; shared board per location; failure handling | flow.test.js |
| Credit notes not capped in total | Low | credits link to their invoice; total capped | flow.test.js |
| Availability leaked across operator orgs | Low | booking details only for the owning studio | code review |
| Matching revealed seller schedules | Low | availability removed from matching | matching.test.js, flow.test.js |
| Documents readable by any org member; no quota; malformed ids 500 | Low | Brand Owner + platform staff; 1 GB/org; 404 | flow.test.js |
| Revoked user kept receiving pushes up to 30 s | Low | access re-checked before every push (5 s cache) | code review |
| Client IP behind the proxy ignored (`TRUST_PROXY_HOPS`) | High (found by us) | `TRUSTED_PROXIES` address list | proxy.test.js |

Open business question (not a code defect): brands set the production and performance fees on their own campaigns; Creator Hub may want to approve or fix them.
