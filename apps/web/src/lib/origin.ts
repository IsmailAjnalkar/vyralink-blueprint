// CSRF check for state-changing requests: the browser's Origin must be this site.
// Behind Docker or a load balancer the server's own URL (req.nextUrl) is its bind address, not the public one, so we
// compare against WEB_ORIGINS when set (recommended in production) or else the Host header the browser sent. A page on
// another site can't make the victim's browser send our Host with its own Origin, so either way cross-site writes fail.
import type { NextRequest } from "next/server";

const allowed = (process.env.WEB_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (allowed.length) return allowed.includes(origin);
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
