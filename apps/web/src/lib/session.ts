// Server-side helpers for Server Components: read the session cookie and call the API directly.
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL, ORG_COOKIE, SESSION_COOKIE } from "./config";

export type Membership = { org_id: string; name: string; kind: "brand" | "operator"; status: string; role: string };
export type Me = {
  user: { id: string; email: string; name: string; is_super_admin: boolean; is_support_admin: boolean };
  memberships: Membership[];
  sellerProfile: { display_name: string } | null;
  mfa: { enabled: boolean; required: boolean; passed: boolean };
};

export async function serverApi<T>(path: string, init: { org?: string | null } = {}): Promise<{ status: number; data: T | null }> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return { status: 401, data: null };
  const res = await fetch(`${API_URL}/v1/${path.replace(/^\//, "")}`, {
    headers: { authorization: `Bearer ${token}`, ...(init.org ? { "x-org-id": init.org } : {}) },
    cache: "no-store",
  });
  return { status: res.status, data: res.ok ? ((await res.json()) as T) : null };
}

/** Signed-in user or redirect to sign-in. Also resolves the current organization (cookie, else the first membership). */
export async function requireMe(): Promise<{ me: Me; current: Membership | null }> {
  const { status, data } = await serverApi<Me>("me");
  if (status === 401 || !data) redirect("/login");
  const jar = await cookies();
  const chosen = jar.get(ORG_COOKIE)?.value;
  const current = data.memberships.find((m) => m.org_id === chosen) ?? data.memberships[0] ?? null;
  return { me: data, current };
}
