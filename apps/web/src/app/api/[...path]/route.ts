// Same-origin proxy from the browser to the Vyralink API.
// - The session lives in an httpOnly cookie; it is sent to the API as a Bearer token and never reaches browser JavaScript.
// - State-changing requests must come from this origin (Origin header check) — CSRF protection on top of SameSite=Lax.
// - Sign-in responses set the cookie and drop the token from the body; sign-out clears it.
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { API_URL, COOKIE_SECURE, ORG_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/config";

const TOKEN_ROUTES = new Set(["auth/login", "auth/verify-email", "auth/mfa/verify"]);
const LOGOUT_ROUTES = new Set(["auth/logout", "auth/logout-all"]);
const FORWARD_REQUEST = ["content-type", "user-agent", "accept"];
const FORWARD_RESPONSE = ["content-type", "cache-control", "retry-after"];

/**
 * The caller's real address. The Next.js server appends the connecting peer to X-Forwarded-For, so entries are
 * counted from the right: skip TRUSTED_PROXY_HOPS entries added by our own proxies in front of this app (0 when
 * the app is reached directly). Anything further left was written by the client and is ignored, so the API's
 * per-IP rate limits can't be dodged with a forged header.
 */
function clientIp(req: NextRequest): string {
  const chain = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
  return chain.length ? chain[Math.max(0, chain.length - 1 - hops)] : "127.0.0.1";
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const route = path.join("/");
  if (!/^[\w\-/.]+$/.test(route) || route.includes("..")) return Response.json({ error: "Not found", code: "not_found" }, { status: 404 });

  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (!origin || origin !== req.nextUrl.origin) return Response.json({ error: "Cross-site request refused", code: "csrf" }, { status: 403 });
  }

  const jar = await cookies();
  const headers = new Headers();
  for (const h of FORWARD_REQUEST) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const session = jar.get(SESSION_COOKIE)?.value;
  if (session) headers.set("authorization", `Bearer ${session}`);
  // EventSource can’t set headers, so streams name the organization in ?org=. The API still checks membership.
  const org = req.headers.get("x-org-id") ?? req.nextUrl.searchParams.get("org") ?? jar.get(ORG_COOKIE)?.value;
  if (org) headers.set("x-org-id", org);
  headers.set("x-forwarded-for", clientIp(req));

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
  const upstream = await fetch(`${API_URL}/v1/${route}${req.nextUrl.search}`, { method: req.method, headers, body, cache: "no-store", signal: req.signal });

  const outHeaders = new Headers();
  for (const h of FORWARD_RESPONSE) {
    const v = upstream.headers.get(h);
    if (v) outHeaders.set(h, v);
  }
  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: COOKIE_SECURE, path: "/" };

  if (LOGOUT_ROUTES.has(route)) {
    jar.set(SESSION_COOKIE, "", { ...cookieOpts, maxAge: 0 });
    jar.set(ORG_COOKIE, "", { ...cookieOpts, maxAge: 0 });
  }
  if (TOKEN_ROUTES.has(route) && upstream.ok) {
    const data = await upstream.json();
    if (data.token) {
      // A half-signed-in (MFA pending) token lives only 10 minutes.
      jar.set(SESSION_COOKIE, data.token, { ...cookieOpts, maxAge: data.mfaRequired ? 600 : SESSION_MAX_AGE });
      delete data.token;
    }
    return Response.json(data, { status: upstream.status, headers: outHeaders });
  }
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
