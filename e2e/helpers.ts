// Test plumbing: direct API calls for fixtures the UI doesn't build yet, the email outbox, and TOTP codes.
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { base32Decode, totp } from "../apps/api/src/crypto.js";
import { API, DB } from "./playwright.config";

const pool = new pg.Pool({ connectionString: DB });
export const closeDb = () => pool.end();

export async function call<T = any>(method: string, path: string, { token, org, body }: { token?: string; org?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(org ? { "x-org-id": org } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

/** Token from the newest email to this address (the dev outbox is the jobs table). */
export async function emailToken(to: string): Promise<string> {
  const { rows: [j] } = await pool.query(`SELECT payload FROM jobs WHERE kind = 'email' AND lower(payload->>'to') = lower($1) ORDER BY id DESC LIMIT 1`, [to]);
  return j.payload.text.match(/token=([\w-]+)/)[1];
}

/** A TOTP code for a step not used before: the server refuses replays, so wait for the next 30 s window if needed. */
const lastStep = new Map<string, number>();
export async function freshCode(secret: string): Promise<string> {
  let step = Math.floor(Date.now() / 30000);
  while (step <= (lastStep.get(secret) ?? -1)) {
    await new Promise((r) => setTimeout(r, 1000));
    step = Math.floor(Date.now() / 30000);
  }
  lastStep.set(secret, step);
  return totp(base32Decode(secret), step * 30);
}

/** Sign up through the UI and confirm the email via the link it was sent. Lands on /app. */
export async function signUpUi(page: Page, { kind, name, email, password, company }: { kind: "Brand" | "LIVE Seller" | "Creator Hub staff"; name: string; email: string; password: string; company?: string }) {
  await page.goto("/signup");
  await page.getByRole("radio", { name: new RegExp(`^${kind}`) }).check();
  await page.getByLabel("Your name").fill(name);
  if (company) await page.getByLabel("Company name").fill(company);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(`/verify-email?token=${await emailToken(email)}`);
  await expect(page).toHaveURL(/\/app$/);
}

export async function signInUi(page: Page, email: string, password: string, mfaSecret?: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (mfaSecret) {
    await page.getByLabel("Authenticator code").fill(await freshCode(mfaSecret));
    await page.getByRole("button", { name: "Verify" }).click();
  }
  await expect(page).toHaveURL(/\/app$/);
}

/** `YYYY-MM-DDTHH:mm` in local time, for datetime-local inputs. */
export const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
