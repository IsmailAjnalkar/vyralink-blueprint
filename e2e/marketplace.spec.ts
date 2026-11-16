// Phase 2 marketplace, end to end through the UI (GlowSkin scenario, up to the signed contract):
// brand sign-up → verification → product review → campaign wizard → booth hold → seller sign-up → academy →
// discovery + invite → seller accepts → both sign → messages are masked → the booked booth shows busy to a second campaign.
// The Creator Hub studio (operator org, location, booth) is created through the API: its screens arrive in Phase 3.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { COURSES } from "../apps/api/src/academy.js";
import { call, closeDb, emailToken, freshCode, localInput, signInUi, signUpUi } from "./helpers";
import { ADMIN } from "./playwright.config";

test.describe.configure({ mode: "serial" });
const PASSWORD = "correct-horse-battery-staple";
const maya = { email: "maya@glowskin.test", name: "Maya Chen" };
const sarah = { email: "sarah@sellers.test", name: "Sarah Johnson" };
let adminSecret = "";
let brandPage: Page, sellerPage: Page, adminPage: Page;
let campaignUrl = "";
const start = new Date(Date.now() + 3 * 864e5);
start.setHours(19, 0, 0, 0);
const end = new Date(start.getTime() + 3 * 3.6e6);

const newPage = async (browser: Browser) => (await browser.newContext()).newPage();

test.beforeAll(async ({ browser }) => {
  // Platform admin turns on two-step verification (required for every admin decision).
  const { token } = await call<{ token: string }>("POST", "/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
  adminSecret = (await call<{ secret: string }>("POST", "/auth/mfa/setup", { token })).secret;
  await call("POST", "/auth/mfa/enable", { token, body: { code: await freshCode(adminSecret) } });

  // Creator Hub studio fixture: operator org, a location manager, one location with one booth.
  await call("POST", "/auth/signup", { body: { kind: "staff", name: "Rosa Diaz", email: "rosa@creatorhub.test", password: PASSWORD } });
  const rosa = (await call<{ token: string }>("POST", "/auth/verify-email", { body: { token: await emailToken("rosa@creatorhub.test") } })).token;
  const ops = await call<{ id: string }>("POST", "/admin/orgs", { token, body: { kind: "operator", name: "Creator Hub" } });
  await call("POST", `/admin/orgs/${ops.id}/members`, { token, body: { email: "rosa@creatorhub.test", role: "location_manager" } });
  const loc = await call<{ id: string }>("POST", "/locations", { token: rosa, org: ops.id, body: { name: "Creator Hub Virginia", address: "Richmond, VA", status: "open" } });
  await call("POST", `/locations/${loc.id}/booths`, { token: rosa, org: ops.id, body: { name: "Beauty Booth 01", type: "beauty", categories: ["beauty"] } });

  brandPage = await newPage(browser);
  sellerPage = await newPage(browser);
  adminPage = await newPage(browser);
  await signInUi(adminPage, ADMIN.email, ADMIN.password, adminSecret);
});
test.afterAll(closeDb);

test("brand signs up and gets verified", async () => {
  const page = brandPage;
  await signUpUi(page, { kind: "Brand", name: maya.name, email: maya.email, password: PASSWORD, company: "GlowSkin Beauty" });
  await expect(page.getByText("GlowSkin Beauty").first()).toBeVisible();

  // Publishing is locked until verified.
  await page.getByRole("link", { name: "Verification" }).click();
  await page.getByLabel("Legal company name").fill("GlowSkin Beauty LLC");
  await page.getByLabel("Registration number").fill("VA-2024-118842");
  await page.getByLabel("Business registration").fill("glowskin-registration.pdf");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");

  await adminPage.goto("/app/admin");
  const card = adminPage.locator("div[data-slot=card]", { hasText: "GlowSkin Beauty" });
  await expect(card).toContainText("VA-2024-118842");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByRole("status")).toContainText("GlowSkin Beauty is verified");
});

test("brand adds a product and the admin approves it", async () => {
  const page = brandPage;
  await page.goto("/app/products");
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Product name").fill("Vitamin C Face Serum");
  await page.getByLabel("SKU").fill("GS-VC-30");
  await page.getByLabel("Category").fill("Skincare");
  await page.getByLabel("Price (USD)").fill("40.00");
  await page.getByLabel("Inventory").fill("10000");
  await page.getByLabel("Samples").fill("4");
  await page.getByLabel(/Approved selling points/).fill("Contains 15% vitamin C\nBrightens in 4 weeks");
  await page.getByLabel(/must not make/).fill("Cures acne");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status")).toContainText("saved as a draft");
  await page.getByRole("link", { name: "Vitamin C Face Serum" }).click();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByRole("status")).toContainText("Sent for review");

  await adminPage.goto("/app/admin");
  await adminPage.getByRole("tab", { name: /Products/ }).click();
  await adminPage.locator("div[data-slot=card]", { hasText: "Vitamin C Face Serum" }).getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByRole("status")).toContainText("approved");
});

test("brand builds a campaign with the wizard, publishes it and holds a booth", async () => {
  const page = brandPage;
  await page.goto("/app/campaigns/new");
  // Validation stops an empty step.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-slot=alert]")).toContainText("Give the campaign a name");
  await page.getByLabel("Campaign name").fill("Vitamin C LIVE — GlowSkin");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /Vitamin C Face Serum/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("LIVE starts").fill(localInput(start));
  await page.getByLabel("LIVE ends").fill(localInput(end));
  await page.getByLabel("Creator Hub studio").selectOption({ label: "Creator Hub Virginia · Richmond, VA" });
  await page.getByRole("button", { name: "Continue" }).click();
  for (const [label, value] of [["Seller base rate", "90"], ["Seller commission", "10"], ["Bonus (USD)", "100"], ["Bonus GMV threshold", "5000"], ["production fee", "750"], ["Performance fee", "7"], ["Budget cap", "1500"], ["Target GMV", "10000"]]) {
    await page.getByLabel(new RegExp(label.replace(/[()]/g, "\\$&"))).fill(value);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: COURSES.beauty_claims.title }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("$90.00")).toBeVisible(); // review shows integer-cent money formatted
  await expect(page.getByText("10%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/app\/campaigns\/[\w-]+\?created=1/);
  campaignUrl = page.url().split("?")[0];

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("status").last()).toContainText("Published");
  await page.locator("li", { hasText: "Beauty Booth 01" }).getByRole("button", { name: "Hold" }).click();
  await expect(page.getByRole("status").last()).toContainText("Booth held");
  await expect(page.getByText(/Beauty Booth 01: hold/)).toBeVisible();
});

test("seller signs up, completes the profile and passes the required training", async () => {
  const page = sellerPage;
  await signUpUi(page, { kind: "LIVE Seller", name: sarah.name, email: sarah.email, password: PASSWORD });
  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByLabel("Categories").fill("Skincare, Beauty");
  await page.getByLabel("Languages").fill("English, Spanish");
  await page.getByLabel("Typical base rate (USD)").fill("90");
  await page.getByLabel("Followers (self-reported)").fill("48K");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");

  await page.getByRole("link", { name: "Academy" }).click();
  for (const id of ["live_fundamentals", "beauty_claims"] as const) {
    const course = COURSES[id];
    await page.locator("div[data-slot=card]", { hasText: course.title }).getByRole("button").click();
    const sets = page.locator("fieldset");
    for (let i = 0; i < course.questions.length; i++) await sets.nth(i).getByRole("radio").nth(course.questions[i].answer).check();
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("status")).toContainText("Passed");
  }

  // Identity / payout providers aren't connected: the admin marks them in the sandbox.
  await adminPage.goto("/app/admin");
  await adminPage.getByRole("tab", { name: "Seller checks" }).click();
  await adminPage.getByLabel("Search people").fill("Sarah");
  await adminPage.getByRole("row", { name: /Sarah Johnson/ }).getByRole("button", { name: /Mark verified/ }).click();
  await expect(adminPage.getByRole("status")).toContainText("marked verified");
});

test("brand finds the seller and invites; seller accepts; both sign", async () => {
  const page = brandPage;
  await page.goto(`/app/sellers?campaign=${campaignUrl.split("/").pop()}`);
  const card = page.locator("li", { hasText: sarah.name });
  await expect(card).toContainText("New seller"); // no fake stats before a completed session
  await card.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("status")).toContainText(`Invited ${sarah.name}`);

  await sellerPage.goto("/app/jobs");
  const inv = sellerPage.locator("div[data-slot=card]", { hasText: "Vitamin C LIVE — GlowSkin" });
  await expect(inv).toContainText("$90.00");
  await inv.getByRole("button", { name: "Accept" }).click();
  await sellerPage.getByRole("link", { name: /Review and sign the contract/ }).click();
  await expect(sellerPage.getByText("10% of eligible sales")).toBeVisible();
  await sellerPage.getByLabel(/Type your full legal name/).fill(sarah.name);
  await sellerPage.getByRole("checkbox", { name: /I have read these terms/ }).check();
  await sellerPage.getByRole("button", { name: "Sign contract" }).click();
  await expect(sellerPage.getByRole("status")).toContainText("Waiting for the other side");

  await page.goto(campaignUrl);
  await page.getByRole("link", { name: "Contract v1" }).click();
  await page.getByLabel(/Type your full legal name/).fill(maya.name);
  await page.getByRole("checkbox", { name: /I have read these terms/ }).check();
  await page.getByRole("button", { name: "Sign contract" }).click();
  await expect(page.getByRole("status")).toContainText("Signed by both");
});

test("messages hide contact details", async () => {
  const page = brandPage;
  await page.goto(campaignUrl);
  await page.getByLabel("Message").fill("Text me at 555-123-4567 or maya@glowskin.com before the LIVE");
  await page.getByRole("button", { name: "Send" }).click();
  const msg = page.locator("li", { hasText: "before the LIVE" });
  await expect(msg).toContainText("[phone hidden]");
  await expect(msg).toContainText("[email hidden]");
  await expect(msg).not.toContainText("555-123-4567");
});

test("the booked booth shows busy to an overlapping campaign", async () => {
  const page = brandPage;
  await page.goto("/app/campaigns/new");
  await page.getByLabel("Campaign name").fill("Overlap test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /Vitamin C Face Serum/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("LIVE starts").fill(localInput(new Date(start.getTime() + 3.6e6)));
  await page.getByLabel("LIVE ends").fill(localInput(new Date(end.getTime() + 3.6e6)));
  await page.getByLabel("Creator Hub studio").selectOption({ label: "Creator Hub Virginia · Richmond, VA" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Seller base rate/).fill("90");
  await page.getByLabel(/production fee/).fill("750");
  await page.getByLabel(/Budget cap/).fill("1500");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  const booth = page.locator("li", { hasText: "Beauty Booth 01" });
  await expect(booth).toContainText("busy at this time");
  await expect(booth.getByRole("button", { name: "Hold" })).toBeDisabled();
});
