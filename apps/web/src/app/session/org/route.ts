// Switches the current organization. The choice is only remembered if the user really is a member (checked with the API).
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { COOKIE_SECURE, ORG_COOKIE, SESSION_MAX_AGE } from "@/lib/config";
import { serverApi, type Me } from "@/lib/session";
import { sameOrigin } from "@/lib/origin";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return Response.json({ error: "Cross-site request refused", code: "csrf" }, { status: 403 });
  const { orgId } = (await req.json().catch(() => ({}))) as { orgId?: string };
  const { data } = await serverApi<Me>("me");
  if (!data) return Response.json({ error: "Sign in first", code: "unauthenticated" }, { status: 401 });
  if (!data.memberships.some((m) => m.org_id === orgId)) return Response.json({ error: "You’re not a member of that organization", code: "forbidden" }, { status: 403 });
  (await cookies()).set(ORG_COOKIE, orgId!, { httpOnly: true, sameSite: "lax", secure: COOKIE_SECURE, path: "/", maxAge: SESSION_MAX_AGE });
  return Response.json({ ok: true });
}
