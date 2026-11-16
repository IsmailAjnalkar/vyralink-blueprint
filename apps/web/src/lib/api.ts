// Browser-side API client: calls this app's /api proxy (same origin, cookie session).
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: string[]) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; org?: string } = {}): Promise<T> {
  const res = await fetch(`/api/${path.replace(/^\//, "")}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...(init.org ? { "x-org-id": init.org } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Something went wrong", data?.code, data?.details);
  return data as T;
}

/**
 * Parses a decimal string into integer units without floating point: toUnits("90.5") = 9050 (cents),
 * toUnits("12.5") = 1250 (basis points from a percent). Returns null when blank, NaN when malformed.
 */
export function toUnits(input: string | null | undefined): number | null {
  const s = (input ?? "").trim().replace(/[$,%\s]/g, "");
  if (!s) return null;
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return NaN;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
/** Basis points to a percent label: 1250 → "12.5%". */
export const pct = (bps: number | null | undefined) => (bps == null ? "—" : `${bps / 100}%`);

/** Money is integer cents in the API; format only for display. */
export const usd = (cents: number | null | undefined) => (cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100));
