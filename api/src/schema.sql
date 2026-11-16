-- Vyralink + Creator Hub MVP schema. Money is integer cents; rates are basis points (500 = 5%).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  is_super_admin boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('brand', 'operator')),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'submitted', 'in_review', 'verified', 'rejected', 'suspended')),
  suspended_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  org_id uuid NOT NULL REFERENCES orgs ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('brand_owner', 'brand_marketing_manager', 'location_manager', 'producer', 'inventory', 'finance_admin')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs ON DELETE CASCADE,
  version int NOT NULL,
  details jsonb NOT NULL,
  documents jsonb NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'info_requested')),
  note text,
  decided_by uuid REFERENCES users,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, version)
);

CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  rate_cents int CHECK (rate_cents >= 0),
  commission_bps int CHECK (commission_bps BETWEEN 0 AND 10000),
  followers_self_reported text,
  availability jsonb NOT NULL DEFAULT '{}',
  identity_verified boolean NOT NULL DEFAULT false,
  payout_verified boolean NOT NULL DEFAULT false,
  tax_form_on_file boolean NOT NULL DEFAULT false,
  no_shows int NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificates (
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  course text NOT NULL,
  score int NOT NULL,
  passed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, course)
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs ON DELETE CASCADE,
  name text NOT NULL,
  sku text NOT NULL,
  price_cents int NOT NULL CHECK (price_cents > 0),
  category text NOT NULL,
  inventory int NOT NULL DEFAULT 0 CHECK (inventory >= 0),
  samples_available int NOT NULL DEFAULT 0 CHECK (samples_available >= 0),
  commission_bps int NOT NULL DEFAULT 500 CHECK (commission_bps BETWEEN 0 AND 10000),
  description text NOT NULL DEFAULT '',
  selling_points text[] NOT NULL DEFAULT '{}',
  restricted_claims text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, sku)
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/New_York',
  setup_min int NOT NULL DEFAULT 30,
  teardown_min int NOT NULL DEFAULT 15,
  hold_hours int NOT NULL DEFAULT 24,
  sample_cutoff_hours int NOT NULL DEFAULT 48,
  checkin_open_min int NOT NULL DEFAULT 60,
  no_show_min int NOT NULL DEFAULT 15,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('opening', 'open', 'closed'))
);

CREATE TABLE IF NOT EXISTS booths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'retired')),
  UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'live_shopping' CHECK (type IN ('live_shopping', 'live_drop')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'published', 'recruiting', 'scheduled', 'in_progress', 'completed', 'cancelled', 'disputed', 'archived')),
  product_ids uuid[] NOT NULL DEFAULT '{}',
  location_id uuid REFERENCES locations,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  base_rate_cents int NOT NULL CHECK (base_rate_cents >= 0),
  commission_bps int NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  bonus_cents int NOT NULL DEFAULT 0 CHECK (bonus_cents >= 0),
  bonus_gmv_threshold_cents int,
  production_fee_cents int NOT NULL CHECK (production_fee_cents >= 0),
  performance_fee_bps int NOT NULL CHECK (performance_fee_bps BETWEEN 0 AND 10000),
  budget_cap_cents int NOT NULL CHECK (budget_cap_cents >= 0),
  target_gmv_cents int,
  required_courses text[] NOT NULL DEFAULT '{}',
  required_category text,
  approval_note text,
  cancel_fee_cents int,
  created_by uuid REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES users,
  kind text NOT NULL DEFAULT 'invite' CHECK (kind IN ('invite', 'application')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'applied', 'viewed', 'countered', 'accepted', 'declined', 'expired', 'withdrawn')),
  terms jsonb NOT NULL,
  counter jsonb,
  message text,
  decline_reason text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, seller_id)
);

CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES users,
  version int NOT NULL,
  terms jsonb NOT NULL,
  brand_signed_by uuid REFERENCES users,
  brand_signed_at timestamptz,
  seller_signed_at timestamptz,
  void boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_id uuid NOT NULL REFERENCES booths,
  campaign_id uuid NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  seller_id uuid REFERENCES users,
  producer_id uuid REFERENCES users,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  slot tstzrange NOT NULL,
  status text NOT NULL DEFAULT 'hold' CHECK (status IN ('hold', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show', 'expired')),
  hold_expires_at timestamptz,
  checkin_code text NOT NULL,
  checked_in_at timestamptz,
  go_at timestamptz,
  go_override_reason text,
  actual_start timestamptz,
  actual_end timestamptz,
  minutes_lost int NOT NULL DEFAULT 0,
  partial boolean NOT NULL DEFAULT false,
  results_status text NOT NULL DEFAULT 'pending' CHECK (results_status IN ('pending', 'imported', 'locked')),
  returns_window_ends_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- No two active bookings may overlap on the same booth, producer or seller (slot includes setup/teardown buffers).
  EXCLUDE USING gist (booth_id WITH =, slot WITH &&) WHERE (status IN ('hold', 'confirmed', 'checked_in', 'in_progress')),
  EXCLUDE USING gist (producer_id WITH =, slot WITH &&) WHERE (producer_id IS NOT NULL AND status IN ('hold', 'confirmed', 'checked_in', 'in_progress')),
  EXCLUDE USING gist (seller_id WITH =, slot WITH &&) WHERE (seller_id IS NOT NULL AND status IN ('hold', 'confirmed', 'checked_in', 'in_progress'))
);

CREATE TABLE IF NOT EXISTS readiness (
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  item text NOT NULL,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'pass', 'fail')),
  note text,
  by_user uuid REFERENCES users,
  at timestamptz,
  PRIMARY KEY (booking_id, item)
);

CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL,
  booth_id uuid REFERENCES booths,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'needs_check', 'repair', 'retired')),
  UNIQUE (location_id, code)
);

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products,
  expected_qty int NOT NULL CHECK (expected_qty > 0),
  received_qty int,
  tracking text,
  condition text CHECK (condition IN ('good', 'damaged', 'opened')),
  shelf text,
  status text NOT NULL DEFAULT 'expected' CHECK (status IN ('expected', 'received', 'short')),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sample chain of custody: balance = received - used - returned - disposed.
CREATE TABLE IF NOT EXISTS sample_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('received', 'used', 'returned', 'disposed', 'moved')),
  qty int NOT NULL CHECK (qty > 0),
  from_place text,
  to_place text,
  by_user uuid REFERENCES users,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('technical', 'connection', 'compliance', 'seller', 'safety', 'platform')),
  severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'resolved')),
  minutes_lost int NOT NULL DEFAULT 0 CHECK (minutes_lost >= 0),
  resolution text,
  emergency_stop boolean NOT NULL DEFAULT false,
  opened_by uuid REFERENCES users,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Producer entries during the LIVE: monitoring only, never a pay or fee basis.
CREATE TABLE IF NOT EXISTS metric_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  orders int NOT NULL CHECK (orders >= 0),
  gmv_cents int NOT NULL CHECK (gmv_cents >= 0),
  as_of timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'TikTok LIVE dashboard on studio device',
  by_user uuid REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Imported TikTok Shop report lines: the basis for commission and performance fee.
CREATE TABLE IF NOT EXISTS session_orders (
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  order_id text NOT NULL,
  placed_at timestamptz NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL CHECK (status IN ('completed', 'cancelled', 'refunded')),
  refund_cents int NOT NULL DEFAULT 0 CHECK (refund_cents >= 0),
  attributed boolean NOT NULL DEFAULT true,
  excluded_reason text,
  PRIMARY KEY (booking_id, order_id)
);

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES orgs,
  campaign_id uuid REFERENCES campaigns,
  booking_id uuid REFERENCES bookings,
  kind text NOT NULL CHECK (kind IN ('production', 'performance', 'cancellation', 'credit_note')),
  basis text NOT NULL,
  amount_cents int NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'disputed', 'void', 'credited')),
  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_booking_kind ON invoices (booking_id, kind) WHERE kind IN ('production', 'performance');

CREATE TABLE IF NOT EXISTS payout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'executed')),
  total_cents int NOT NULL DEFAULT 0,
  approvals uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES payout_runs ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES users,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'paid', 'failed')),
  failure_reason text,
  idempotency_key text NOT NULL UNIQUE,
  attempts int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users,
  booking_id uuid REFERENCES bookings,
  kind text NOT NULL CHECK (kind IN ('base', 'commission', 'bonus', 'adjustment')),
  basis text NOT NULL,
  amount_cents int NOT NULL,
  status text NOT NULL CHECK (status IN ('provisional', 'locked', 'scheduled', 'paid', 'on_hold')),
  payout_id uuid REFERENCES payouts,
  reason text,
  created_by uuid REFERENCES users,
  approved_by uuid REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_per_booking_kind ON ledger_entries (booking_id, kind) WHERE kind <> 'adjustment';

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('invoice', 'attribution', 'commission', 'deliverables', 'cancellation_fee')),
  opened_by uuid NOT NULL REFERENCES users,
  booking_id uuid REFERENCES bookings,
  invoice_id uuid REFERENCES invoices,
  ledger_entry_id uuid REFERENCES ledger_entries,
  amount_cents int NOT NULL CHECK (amount_cents >= 0),
  claim text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'decided')),
  decision text,
  outcome_cents int,
  decided_by uuid REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  org_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  detail jsonb NOT NULL DEFAULT '{}',
  ip text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  phase text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  org_ids uuid[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Defaults. Values marked TODO are placeholders in the blueprint ([N]) and must be set by the business.
INSERT INTO settings (key, value) VALUES
  ('default_commission_bps', '500'),
  ('performance_fee_bps', '700'),
  ('returns_window_days', '30'),            -- TODO: blueprint placeholder [N]
  ('invite_expiry_hours', '48'),
  ('approval_threshold_cents', '100000'),   -- campaigns over $1,000 need Brand Owner approval
  ('payout_two_approval_cents', '500000'),  -- TODO: blueprint placeholder [N]
  ('adjustment_approval_cents', '10000'),   -- ledger adjustments over $100 need a second approver
  ('invoice_due_days', '15')
ON CONFLICT (key) DO NOTHING;

INSERT INTO feature_flags (key, phase) VALUES
  ('tiktok_shop_sync', 'P2'), ('multi_location', 'P2'), ('managed_retainers', 'P2'),
  ('instant_payouts', 'P2'), ('sms_notifications', 'P2'), ('ai_matching', 'P3')
ON CONFLICT (key) DO NOTHING;
