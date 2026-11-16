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
| Brand verification | Working | Working | documents uploaded (local storage), opened by the brand and reviewers only |
| Products (incl. claims review) | Working | Working | image upload works (local storage) |
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
| LIVE metrics, incidents, emergency stop, closeout | Working | Working | metrics are Manual until a TikTok data integration exists; Vyralink never controls the stream |
| Control center | Working (SSE) | Working | pushed via Postgres NOTIFY; E2E-verified |
| Results / refunds import (CSV) | Working | Working | file upload or paste |
| Reconciliation and lock | Working | Working | |
| Invoices, credit notes | Working | Working | card payments **Blocked** (Stripe account); webhook handler built and tested with signed test events, not yet against Stripe |
| Seller ledger, adjustments (two-person) | Working | Working | E2E-verified second approver |
| Payout runs (two-person) | Working | Working | sending is a sandbox simulation; real payouts **Blocked** (Stripe Connect) |
| Disputes | Working | Working | evidence is text; attachments need storage |
| Brand campaign report | Working | Working | |
| Notifications (in-app) | Working | Working | email delivery **Blocked** (no provider) |
| Messages | Working | Working | contact details masked (E2E-verified) |
| Admin: verifications, moderation, orgs, users, flags, settings, audit | Working | Partial | review queue, organizations, settings, disputes; flags, user lock and audit viewer not built |
| TikTok Shop API | Blocked | — | no partner access; CSV import works; sandbox demo-order provider for development (`ORDERS_PROVIDER=sandbox`) |
| Stripe | Blocked | — | no account; sandbox provider; signed webhook handler ready |
| File storage | Partial | Working | local-disk adapter (product images, verification documents); S3 **Blocked** (no bucket) |
| Matching (rules-based, explained) | Working | Working | published weights; reasons per point; excluded sellers counted, never named |
| Analytics (brand, studio) | Working | Working | conversion/viewers need TikTok data (Unavailable) |
| Docker / CI / staging | Missing | — | Phase 9 |
