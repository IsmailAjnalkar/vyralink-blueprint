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
| Brand verification | Working | Working | document upload **Blocked** (no storage); file names recorded |
| Products (incl. claims review) | Working | Working | image upload **Blocked** (no storage) |
| Campaigns (LIVE, LIVE DROP) + approval | Working | Working | UGC/influencer/affiliate/retainer types missing |
| Creator discovery, profile, compare | Working (search, profile) | Working | compare is client-side |
| Invitations, applications, counter-offers | Working | Working | counter/decline use a browser prompt (to be replaced by a dialog) |
| Contracts and e-signature | Working | Working | typed-name signature |
| Academy (server-graded) | Working | Working | |
| Locations, booths, equipment | Working | Working | |
| Booking: hold, confirm, cancel, conflicts, move, reschedule | Working | Working | reschedule covers holds only; a confirmed session is cancelled and rebooked (two-party reschedule not built) |
| Producer assignment, shifts | Partial | Partial | assignment with overlap protection; no shift roster |
| Shipments, samples, returns | Working | Working | |
| Check-in, no-show, readiness, go | Working | Working | E2E-verified |
| LIVE metrics, incidents, emergency stop, closeout | Working | Missing | real-time push missing |
| Control center | Working (polling) | Missing | SSE planned |
| Results / refunds import (CSV) | Working | Missing | |
| Reconciliation and lock | Working | Missing | |
| Invoices, credit notes | Working | Missing | real payments **Blocked** (Stripe account) |
| Seller ledger, adjustments (two-person) | Working | Partial | seller earnings page; finance screens Phase 5 |
| Payout runs (two-person) | Working | Missing | real payouts **Blocked** |
| Disputes | Working | Missing | |
| Brand campaign report | Working | Missing | |
| Notifications (in-app) | Working | Missing | email delivery missing |
| Messages | Working | Working | contact details masked (E2E-verified) |
| Admin: verifications, moderation, orgs, users, flags, settings, audit | Working | Partial | review queue (verifications, products, seller sandbox checks); rest later |
| TikTok Shop API | Blocked | — | no partner access; CSV import works |
| Stripe | Blocked | — | no account; simulated |
| File storage (S3) | Missing | — | |
| Matching (rules-based, explained) | Missing | Missing | Phase 7 |
| Docker / CI / staging | Missing | — | Phase 9 |
