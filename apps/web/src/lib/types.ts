// Shapes of API records used by more than one screen (columns as the API returns them).
export type Campaign = {
  id: string; name: string; type: string; status: string; product_ids: string[]; location_id: string | null; starts_at: string; ends_at: string;
  base_rate_cents: number; commission_bps: number; bonus_cents: number; bonus_gmv_threshold_cents: number | null; production_fee_cents: number;
  performance_fee_bps: number; budget_cap_cents: number; target_gmv_cents: number | null; required_courses: string[]; required_category: string | null;
  approval_note: string | null; cancel_fee_cents: number | null;
};
