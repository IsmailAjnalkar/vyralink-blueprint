-- The last accepted TOTP time step: a code can be used once, never replayed within its 30-second window.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_step bigint;
