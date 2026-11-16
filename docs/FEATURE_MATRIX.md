# Feature matrix

Status: **Working** (built and tested), **Partial**, **Missing**, **Blocked** (needs an external account or approval). "API" and "UI" are tracked separately.

| Feature | API | UI | Notes |
|---|---|---|---|
| Registration / login / logout | Working | Working | httpOnly cookie via web proxy; MFA step in sign-in |
| Email verification | Working | Working | dev outbox; real email **Blocked** (no provider) |
| Password reset | Working | Working | signs out every session |
| MFA for privileged users | Working | Working | TOTP, secrets encrypted at rest |
| Rate limiting / lockout | Working | — | |
| Sessions: expiry, revocation | Working | Working | |
| Organizations, members, roles | Working | Working | incl. Support Admin, Brand Finance |
| Organization invitations by email | Working | Working | |
| Brand verification | Working | Missing | |
| Products (incl. claims review) | Working | Missing | image upload missing |
| Campaigns (LIVE, LIVE DROP) + approval | Working | Missing | UGC/influencer/affiliate/retainer types missing |
| Creator discovery, profile, compare | Working (search, profile) | Missing | compare is client-side |
| Invitations, applications, counter-offers | Working | Missing | |
| Contracts and e-signature | Working | Missing | |
| Academy (server-graded) | Working | Missing | |
| Locations, booths, equipment | Working | Missing | |
| Booking: hold, confirm, cancel, conflicts | Working | Missing | rescheduling missing |
| Producer assignment, shifts | Partial | Missing | no shift table |
| Shipments, samples, returns | Working | Missing | |
| Check-in, no-show, readiness, go | Working | Missing | |
| LIVE metrics, incidents, emergency stop, closeout | Working | Missing | real-time push missing |
| Control center | Working (polling) | Missing | SSE planned |
| Results / refunds import (CSV) | Working | Missing | |
| Reconciliation and lock | Working | Missing | |
| Invoices, credit notes | Working | Missing | real payments **Blocked** (Stripe account) |
| Seller ledger, adjustments (two-person) | Working | Missing | |
| Payout runs (two-person) | Working | Missing | real payouts **Blocked** |
| Disputes | Working | Missing | |
| Brand campaign report | Working | Missing | |
| Notifications (in-app) | Working | Missing | email delivery missing |
| Messages | Working | Missing | |
| Admin: verifications, moderation, orgs, users, flags, settings, audit | Working | Missing | |
| TikTok Shop API | Blocked | — | no partner access; CSV import works |
| Stripe | Blocked | — | no account; simulated |
| File storage (S3) | Missing | — | |
| Matching (rules-based, explained) | Missing | Missing | Phase 7 |
| Docker / CI / staging | Missing | — | Phase 9 |
