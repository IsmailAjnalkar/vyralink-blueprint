-- Two-party reschedule of a confirmed session: one side proposes a new time, the other accepts or declines.
-- The signed contract is not rewritten; the accepted request is the amendment both sides agreed to.
CREATE TABLE IF NOT EXISTS reschedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('brand', 'seller')),
  requested_by uuid NOT NULL REFERENCES users,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  decided_by uuid REFERENCES users,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- At most one open proposal per session.
CREATE UNIQUE INDEX IF NOT EXISTS reschedule_one_pending ON reschedule_requests (booking_id) WHERE status = 'pending';
