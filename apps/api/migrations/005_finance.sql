-- Explicit currency on every money record. Only USD is supported today; the CHECK makes a second currency a deliberate change.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');
ALTER TABLE session_orders ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD');

-- Payment-provider webhooks: each event id is processed once, however often the provider retries it.
CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  type text NOT NULL,
  outcome text NOT NULL DEFAULT 'processed',
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
