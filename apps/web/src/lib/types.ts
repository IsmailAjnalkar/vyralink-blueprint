// Shapes of API records used by more than one screen (columns as the API returns them).
export type Campaign = {
  id: string; name: string; type: string; status: string; product_ids: string[]; location_id: string | null; starts_at: string; ends_at: string;
  base_rate_cents: number; commission_bps: number; bonus_cents: number; bonus_gmv_threshold_cents: number | null; production_fee_cents: number;
  performance_fee_bps: number; budget_cap_cents: number; target_gmv_cents: number | null; required_courses: string[]; required_category: string | null;
  approval_note: string | null; cancel_fee_cents: number | null;
};

export type Location = {
  id: string; org_id: string; name: string; address: string; timezone: string; status: string;
  setup_min: number; teardown_min: number; hold_hours: number; sample_cutoff_hours: number; checkin_open_min: number; no_show_min: number;
};
export type Booth = { id: string; name: string; type: string; categories: string[]; status: string };
export type Equipment = { id: string; code: string; type: string; booth_id: string | null; status: string };
export type Booking = {
  id: string; status: string; starts_at: string; ends_at: string; booth: string; booth_id: string; location_id: string; campaign: string; campaign_id: string; campaign_status: string;
  seller_id: string | null; producer_id: string | null; seller?: string | null; hold_expires_at: string | null; checkin_code?: string; checked_in_at: string | null; go_at: string | null;
  arrival_at?: string; no_show_min: number; checkin_open_min: number; sample_cutoff_hours: number; readiness?: { item: string; result: string; note: string | null }[];
};
export type Shipment = { id: string; product: string; product_id: string; expected_qty: number; received_qty: number | null; tracking: string | null; condition: string | null; shelf: string | null; status: string; overdue: boolean; cutoff: string };

export type Invoice = { id: string; number: string; brand?: string; kind: string; basis: string; amount_cents: number; currency: string; status: string; issued_at: string | null; due_at: string | null; paid_at: string | null; booking_id: string | null; campaign_id: string | null };
export type LedgerEntry = { id: string; seller: string; seller_id: string; booking_id: string; kind: string; basis: string; amount_cents: number; currency: string; status: string; reason: string | null; created_at: string; created_by: string | null };
export type Dispute = { id: string; type: string; status: string; amount_cents: number; claim: string; decision: string | null; outcome_cents: number | null; booking_id: string | null; invoice_id: string | null; opened_by: string; created_at: string; evidence: { by: string; note: string; at: string }[] };
