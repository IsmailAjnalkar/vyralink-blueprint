// Server-only settings. The API host is never exposed to the browser.
export const API_URL = (process.env.API_URL ?? "http://127.0.0.1:4020").replace(/\/$/, "");
export const SESSION_COOKIE = "vl_session";
export const ORG_COOKIE = "vl_org";
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
export const SESSION_MAX_AGE = 30 * 24 * 3600;
