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
| Secure cookies + CSRF | Missing | Phase 1 |
| Email verification / password reset | Done | `auth.test.js` |
| MFA for privileged users | Done | TOTP; `auth.test.js`, flow test enrollment gate |
| Rate limiting / lockout | Done | `auth.test.js` |
| Session revocation | Done | `auth.test.js` |
| Security headers (CSP, HSTS) | Missing | Phase 1 (web) |
| Secure file uploads | Missing | Phase 6 |
| Webhook signature + replay protection | Missing | Phase 6 |
| Secrets outside source | Done | env vars; no secrets committed |
| Dependency scanning | Missing | Phase 9 CI (`npm audit`) |
| Data retention / account deletion | Missing | Phase 8 |
