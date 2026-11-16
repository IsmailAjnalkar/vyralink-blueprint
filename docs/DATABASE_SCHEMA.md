# Database schema

Source of truth: `apps/api/src/schema.sql` (PostgreSQL 18). Money is integer cents; rates are basis points.

| Group | Tables | Key constraints |
|---|---|---|
| Identity | `users`, `sessions`, `orgs`, `memberships`, `verifications` | unique lower(email); session tokens stored as SHA-256 hashes; role CHECK per membership |
| Marketplace | `seller_profiles`, `certificates`, `assessment_attempts`, `products`, `campaigns`, `invitations`, `contracts` | unique (org, sku); one invitation per (campaign, seller); contracts versioned per campaign |
| Studio | `locations`, `booths`, `bookings`, `readiness`, `equipment`, `shipments`, `sample_movements`, `incidents`, `metric_entries` | **bookings: three `EXCLUDE USING gist` constraints** — no overlapping active booking per booth, producer or seller (slot includes buffers) |
| Commerce | `session_orders` | primary key (booking, order_id); attribution flag and exclusion reason per order |
| Finance | `invoices`, `ledger_entries`, `payout_runs`, `payouts`, `disputes` | one production and one performance invoice per booking; one base/commission/bonus line per booking; adjustments append-only; payout idempotency key unique |
| Platform | `messages`, `notifications`, `audit_log`, `feature_flags`, `settings` | audit log append-only |

## Mapping to the brief's table names

`organization_members` → `memberships`; `campaign_invitations` + `campaign_applications` → `invitations` (kind = invite / application); `creator_profiles` → `seller_profiles`; `creator_certifications` → `certificates`; `studio_bookings` → `bookings`; `readiness_checklists` → `readiness`; `session_incidents` → `incidents`; `inventory_movements` → `sample_movements`; `external_orders` → `session_orders`; `payout_records` → `payouts`; `earnings`/`commissions`/`bonuses` → `ledger_entries` (kind); `financial_adjustments` → `ledger_entries` (kind = adjustment).

## Planned additions

Phase 1: `auth_tokens` (email verification, password reset, invitations), `mfa_secrets`, `login_attempts`, `jobs`. Phase 5: explicit `currency` on money tables. Phase 6: `commerce_connections`, `sync_jobs`, `webhook_events`, `files`.
