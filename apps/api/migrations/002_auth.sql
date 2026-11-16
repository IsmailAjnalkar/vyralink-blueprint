-- Phase 1: email verification, password reset, invitations, MFA, lockout, revocable sessions, job queue, new roles.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_support_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_logins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_secret_enc text,          -- AES-256-GCM with APP_SECRET; never returned
  ADD COLUMN IF NOT EXISTS mfa_enabled_at timestamptz;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS mfa_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_mfa boolean NOT NULL DEFAULT false;  -- password ok, waiting for the second factor
CREATE UNIQUE INDEX IF NOT EXISTS sessions_id_key ON sessions (id);

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('brand_owner', 'brand_marketing_manager', 'brand_finance', 'location_manager', 'producer', 'inventory', 'finance_admin'));

-- One-time tokens, stored as SHA-256 hashes only.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('verify_email', 'reset_password', 'invite')),
  user_id uuid REFERENCES users ON DELETE CASCADE,
  org_id uuid REFERENCES orgs ON DELETE CASCADE,
  role text,
  email text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES users,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transactional outbox: jobs are written in the same transaction as the change that causes them.
CREATE TABLE IF NOT EXISTS jobs (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  run_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  locked_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_ready ON jobs (run_at) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id text PRIMARY KEY,
  seen_at timestamptz NOT NULL
);

INSERT INTO settings (key, value) VALUES ('lockout_after_failures', '5'), ('lockout_minutes', '15') ON CONFLICT (key) DO NOTHING;
