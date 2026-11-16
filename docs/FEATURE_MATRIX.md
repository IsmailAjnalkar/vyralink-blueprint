# Feature matrix

Status: **Working** (built and tested), **Partial**, **Missing**, **Blocked** (needs an external account or approval). "API" and "UI" are tracked separately.

| Feature | API | UI | Notes |
|---|---|---|---|
| Registration / login / logout | Working | Missing | bearer tokens only |
| Email verification | Missing | Missing | Phase 1 |
| Password reset | Missing | Missing | Phase 1 |
| MFA for privileged users | Missing | Missing | Phase 1 |
| Rate limiting / lockout | Missing | — | Phase 1 |
| Sessions: expiry, revocation | Partial | Missing | expiry yes; revocation list missing |
| Organizations, members, roles | Working | Missing | add Support Admin, Brand Finance |
| Organization invitations by email | Missing | Missing | members must already have accounts |
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
