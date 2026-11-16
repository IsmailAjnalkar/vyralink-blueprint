// GlowSkin scenario end to end through the web UI on a fresh database.
// Phase 2 (marketplace): brand sign-up → verification → product review → campaign wizard → booth hold → seller sign-up →
//   academy → discovery + invite → accept → both sign → masked messages.
// Phase 3 (studio): Creator Hub set up in the UI (admin creates the org, Location Manager adds location/booths and invites staff) →
//   producer assigned → confirmed → samples shipped and received → booth move → seller sees code + briefing → check-in →
//   readiness → Go. Overlap is refused; a fresh hold is rescheduled.
// Only the platform admin's MFA enrolment uses the API directly (the code is computed here; the UI login uses it).
import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { COURSES } from "../apps/api/src/academy.js";
import { call, closeDb, emailToken, freshCode, localInput, signInUi, signUpUi } from "./helpers";
import { ADMIN } from "./playwright.config";

test.describe.configure({ mode: "serial" });
const PASSWORD = "correct-horse-battery-staple";
const maya = { email: "maya@glowskin.test", name: "Maya Chen" };
const sarah = { email: "sarah@sellers.test", name: "Sarah Johnson" };
const rosa = { email: "rosa@creatorhub.test", name: "Rosa Diaz" };
const jordan = { email: "jordan@creatorhub.test", name: "Jordan Park" };
const sam = { email: "sam@creatorhub.test", name: "Sam Kim" };
const alex = { email: "alex@creatorhub.test", name: "Alex Morgan" };
let adminSecret = "";
let brandPage: Page, sellerPage: Page, adminPage: Page, rosaPage: Page, jordanPage: Page, samPage: Page, alexPage: Page;
let campaignUrl = "";
// Soon enough that check-in is open (it opens 60 min before arrival = start − 45 min).
const start = new Date(Date.now() + 50 * 60000);
start.setSeconds(0, 0);
const end = new Date(start.getTime() + 3 * 3.6e6);

const newPage = async (browser: Browser) => (await browser.newContext()).newPage();
const card = (page: Page, text: string) => page.locator("div[data-slot=card]", { hasText: text });

test.beforeAll(async ({ browser }) => {
  const { token } = await call<{ token: string }>("POST", "/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
  adminSecret = (await call<{ secret: string }>("POST", "/auth/mfa/setup", { token })).secret;
  await call("POST", "/auth/mfa/enable", { token, body: { code: await freshCode(adminSecret) } });
  [brandPage, sellerPage, adminPage, rosaPage, jordanPage, samPage, alexPage] = await Promise.all(Array.from({ length: 7 }, () => newPage(browser)));
  await signInUi(adminPage, ADMIN.email, ADMIN.password, adminSecret);
});
test.afterAll(closeDb);

test("Creator Hub is set up through the UI", async () => {
  // Test configuration: a zero-day returns window so results can be locked within the run (default is 30 days).
  await adminPage.goto("/app/admin");
  await adminPage.getByRole("tab", { name: "Settings" }).click();
  await adminPage.getByLabel("returns_window_days").fill("0");
  await adminPage.locator("form", { has: adminPage.getByLabel("returns_window_days") }).getByRole("button", { name: "Save" }).click();
  await expect(adminPage.getByRole("status")).toContainText("returns_window_days = 0");

  await signUpUi(rosaPage, { kind: "Creator Hub staff", name: rosa.name, email: rosa.email, password: PASSWORD });
  await adminPage.goto("/app/admin");
  await adminPage.getByRole("tab", { name: "Organizations" }).click();
  await adminPage.getByLabel("Organization name").fill("Creator Hub");
  await adminPage.getByLabel("Location Manager’s account email").fill(rosa.email);
  await adminPage.getByRole("button", { name: "Create" }).click();
  await expect(adminPage.getByRole("status")).toContainText("Creator Hub created");

  const page = rosaPage;
  await page.goto("/app/studio/locations");
  await page.getByLabel("Name", { exact: true }).fill("Creator Hub Virginia");
  await page.getByLabel("Address", { exact: true }).fill("Richmond, VA");
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page.getByRole("status")).toContainText("Location added");
  for (const name of ["Beauty Booth 01", "Beauty Booth 02"]) {
    await page.getByLabel("Booth name").fill(name);
    await page.getByLabel("Type", { exact: true }).first().fill("beauty");
    await page.getByRole("button", { name: "Add booth" }).click();
    await expect(page.getByRole("cell", { name })).toBeVisible();
  }

  // Studio staff join by invitation.
  for (const [who, role, p] of [[jordan, "Studio Producer", jordanPage], [sam, "Inventory Coordinator", samPage], [alex, "Finance Administrator", alexPage]] as const) {
    await page.goto("/app/settings/team");
    await page.getByLabel("Email").fill(who.email);
    await page.getByLabel("Role", { exact: true }).selectOption({ label: role });
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByRole("status")).toContainText(`Invitation sent to ${who.email}`);
    const invite = await emailToken(who.email);
    await signUpUi(p, { kind: "Creator Hub staff", name: who.name, email: who.email, password: PASSWORD });
    await p.goto(`/invite?token=${invite}`);
    await p.getByRole("button", { name: /^Join as/ }).click();
    await expect(p).toHaveURL(/\/app$/);
    await expect(p.getByText(`Creator Hub · ${role}`).first()).toBeVisible();
  }

  // Finance screens stay locked until two-step verification is on.
  await alexPage.goto("/app/finance");
  await expect(alexPage.locator("[data-slot=alert]").first()).toContainText(/two-step/i);
  await alexPage.goto("/app/settings/security");
  await alexPage.getByRole("button", { name: "Set up two-step verification" }).click();
  const secret = (await alexPage.getByLabel("Setup key").textContent())!.trim();
  await alexPage.getByLabel("Enter the 6-digit code it shows").fill(await freshCode(secret));
  await alexPage.getByRole("button", { name: "Turn on" }).click();
  await expect(alexPage.getByText("Signing in asks for a code")).toBeVisible();
});

test("brand signs up and gets verified", async () => {
  const page = brandPage;
  await signUpUi(page, { kind: "Brand", name: maya.name, email: maya.email, password: PASSWORD, company: "GlowSkin Beauty" });
  await expect(page.getByText("GlowSkin Beauty").first()).toBeVisible();
  await page.getByRole("link", { name: "Verification" }).click();
  await page.getByLabel("Legal company name").fill("GlowSkin Beauty LLC");
  await page.getByLabel("Registration number").fill("VA-2024-118842");
  await page.getByLabel("Business registration").fill("glowskin-registration.pdf");
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByRole("status")).toContainText("Submitted");

  await adminPage.goto("/app/admin");
  const c = card(adminPage, "GlowSkin Beauty");
  await expect(c).toContainText("VA-2024-118842");
  await c.getByRole("button", { name: "Approve" }).click();
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
  await card(adminPage, "Vitamin C Face Serum").getByRole("button", { name: "Approve" }).click();
  await expect(adminPage.getByRole("status")).toContainText("approved");
});

/** Fills wizard steps 1–4 (basics, products, schedule, money); leaves the page on step 5 (requirements). */
async function wizard(page: Page, name: string, from: Date, to: Date, full = true) {
  await page.goto("/app/campaigns/new");
  await page.getByLabel("Campaign name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /Vitamin C Face Serum/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("LIVE starts").fill(localInput(from));
  await page.getByLabel("LIVE ends").fill(localInput(to));
  await page.getByLabel("Creator Hub studio").selectOption({ label: "Creator Hub Virginia · Richmond, VA" });
  await page.getByRole("button", { name: "Continue" }).click();
  const money = full
    ? [["Seller base rate", "90"], ["Seller commission", "10"], ["Bonus \\(USD\\)", "100"], ["Bonus GMV threshold", "5000"], ["production fee", "750"], ["Performance fee", "7"], ["Budget cap", "1500"], ["Target GMV", "10000"]]
    : [["Seller base rate", "90"], ["production fee", "750"], ["Budget cap", "1500"]];
  for (const [label, value] of money) await page.getByLabel(new RegExp(label)).fill(value);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("brand builds a campaign with the wizard, publishes it and holds a booth", async () => {
  const page = brandPage;
  await page.goto("/app/campaigns/new");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("[data-slot=alert]")).toContainText("Give the campaign a name");
  await wizard(page, "Vitamin C LIVE — GlowSkin", start, end);
  await page.getByRole("checkbox", { name: COURSES.beauty_claims.title }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("$90.00")).toBeVisible();
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
    await card(page, course.title).getByRole("button").click();
    const sets = page.locator("fieldset");
    for (let i = 0; i < course.questions.length; i++) await sets.nth(i).getByRole("radio").nth(course.questions[i].answer).check();
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page.getByRole("status")).toContainText("Passed");
  }

  await adminPage.goto("/app/admin");
  await adminPage.getByRole("tab", { name: "Seller checks" }).click();
  await adminPage.getByLabel("Search people").fill("Sarah");
  await adminPage.getByRole("row", { name: /Sarah Johnson/ }).getByRole("button", { name: /Mark verified/ }).click();
  await expect(adminPage.getByRole("status")).toContainText("marked verified");
});

test("brand finds the seller and invites; seller accepts; both sign", async () => {
  const page = brandPage;
  await page.goto(`/app/sellers?campaign=${campaignUrl.split("/").pop()}`);
  const c = page.locator("li", { hasText: sarah.name });
  await expect(c).toContainText("New seller");
  await c.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("status")).toContainText(`Invited ${sarah.name}`);

  await sellerPage.goto("/app/jobs");
  const inv = card(sellerPage, "Vitamin C LIVE — GlowSkin");
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
  await page.getByLabel("Message", { exact: true }).fill("Text me at 555-123-4567 or maya@glowskin.com before the LIVE");
  await page.getByRole("button", { name: "Send" }).click();
  const msg = page.locator("li", { hasText: "before the LIVE" });
  await expect(msg).toContainText("[phone hidden]");
  await expect(msg).toContainText("[email hidden]");
  await expect(msg).not.toContainText("555-123-4567");
});

test("studio confirms with a producer; samples are shipped and received; the session moves booth", async () => {
  const page = rosaPage;
  await page.goto("/app/studio/bookings");
  await page.getByRole("link", { name: "Vitamin C LIVE — GlowSkin" }).click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.locator("[data-slot=alert]")).toContainText("Assign a producer");
  await page.getByLabel("Producer").selectOption({ label: jordan.name });
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("status")).toContainText("Producer assigned");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByRole("status")).toContainText("Confirmed");
  const bookingUrl = page.url();

  // Brand announces samples (already past the 48 h cutoff for a same-day LIVE, so it shows overdue).
  await brandPage.goto(campaignUrl);
  await expect(brandPage.getByText(/Beauty Booth 01: confirmed/)).toBeVisible();
  await brandPage.getByLabel("Quantity").fill("4");
  await brandPage.getByLabel("Tracking number").fill("1Z999AA10123456784");
  await brandPage.getByRole("button", { name: "Announce shipment" }).click();
  await expect(brandPage.getByText(/Vitamin C Face Serum: 4 sent/)).toContainText("overdue");

  await samPage.goto(bookingUrl);
  await samPage.getByLabel("Shelf").fill("S2");
  await samPage.getByRole("button", { name: "Receive" }).click();
  await expect(samPage.getByRole("status")).toContainText("Received");
  await expect(samPage.getByText("Samples on hand: 4")).toBeVisible();

  await page.reload();
  await page.getByLabel("Move to booth (same time)").selectOption({ label: "Beauty Booth 02" });
  await page.getByRole("button", { name: "Move" }).click();
  await expect(page.getByRole("status")).toContainText("Moved to Beauty Booth 02");
});

test("seller sees the code and briefing; producer checks in, runs readiness and gives the Go", async () => {
  const s = sellerPage;
  await s.goto("/app/sessions");
  const session = card(s, "Vitamin C LIVE — GlowSkin");
  await expect(session).toContainText("Beauty Booth 02");
  await expect(session).toContainText("Never say: Cures acne");
  const code = (await session.locator(".font-mono").textContent())!.trim();
  expect(code).toMatch(/^VL-\d{4}$/);

  const p = jordanPage;
  await p.goto("/app/studio/bookings");
  await p.getByRole("link", { name: "Vitamin C LIVE — GlowSkin" }).click();
  await p.getByLabel("Check-in code").fill("VL-0000");
  await p.getByRole("button", { name: "Check in" }).click();
  await expect(p.locator("[data-slot=alert]")).toContainText("doesn’t match");
  await p.getByLabel("Check-in code").fill(code);
  await p.getByRole("button", { name: "Check in" }).click();
  await expect(p.getByRole("status")).toContainText("Checked in");

  await s.reload();
  await card(s, "Vitamin C LIVE — GlowSkin").getByRole("button", { name: "I’ve read the briefing" }).click();
  await expect(s.getByRole("status")).toContainText("read the briefing");

  await p.reload();
  for (const item of ["TikTok account logged in", "Products in the TikTok showcase", "Camera and audio", "Network", "Samples at the booth", "Compliance check"]) {
    await p.getByRole("button", { name: new RegExp(`^Pass: ${item}`) }).click();
    await expect(p.locator("li", { hasText: item })).toContainText("passed");
  }
  await p.getByRole("button", { name: "Give the Go" }).click();
  await expect(p.getByRole("status")).toContainText("Go given");
});

test("overlapping time is refused on the busy booth; a free booth is held and rescheduled", async () => {
  const page = brandPage;
  await wizard(page, "Overlap test", new Date(start.getTime() + 3.6e6), new Date(end.getTime() + 3.6e6), false);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  const busy = page.locator("li", { hasText: "Beauty Booth 02" });
  await expect(busy).toContainText("busy at this time");
  await expect(busy.getByRole("button", { name: "Hold" })).toBeDisabled();
  await page.locator("li", { hasText: "Beauty Booth 01" }).getByRole("button", { name: "Hold" }).click();
  await expect(page.getByRole("status").last()).toContainText("Booth held");

  const nextDay = new Date(start.getTime() + 864e5);
  await page.getByLabel("New start").fill(localInput(nextDay));
  await page.getByLabel("New end").fill(localInput(new Date(nextDay.getTime() + 3 * 3.6e6)));
  await page.getByRole("button", { name: "Move hold" }).click();
  await expect(page.getByRole("status").last()).toContainText("Moved");
  await page.reload();
  await expect(page.locator("main")).toContainText(nextDay.toLocaleDateString("en-US", { dateStyle: "medium" }));
});

// ---------------------------------------------------------------- Phase 4: LIVE day
test("control center updates in real time: LIVE start, manual numbers, incidents", async () => {
  const board = rosaPage;
  await board.goto("/app/studio/live");
  await expect(board.getByRole("status").filter({ hasText: "Updates:" })).toContainText("live");
  const session = card(board, "Vitamin C LIVE — GlowSkin");
  await expect(board.getByText(/Vyralink does not control TikTok streams/)).toBeVisible();

  const p = jordanPage;
  await p.goto("/app/studio/live");
  const mine = card(p, "Vitamin C LIVE — GlowSkin");
  await mine.getByRole("button", { name: "Mark LIVE started" }).click();
  await expect(session).toContainText("in progress"); // pushed to the other screen, no reload

  await mine.getByRole("button", { name: "Enter numbers" }).click();
  await mine.getByLabel("Orders (from TikTok Shop)").fill("64");
  await mine.getByLabel("GMV (USD)").fill("2560.00");
  await mine.getByRole("button", { name: "Save" }).click();
  await expect(session).toContainText("$2,560.00");
  await expect(session).toContainText("Manual");
  await expect(session.getByText("Viewers").locator("..")).toContainText("Unavailable");

  await mine.getByRole("button", { name: "Report incident" }).click();
  await mine.getByLabel("Category").selectOption("technical");
  await mine.getByLabel("What happened").fill("Ring light flickering");
  await mine.getByRole("button", { name: "Open incident" }).click();
  await expect(session).toContainText("Ring light flickering");

  const answers = ["Replaced the bulb", "2"];
  const reply = (d: import("@playwright/test").Dialog) => d.accept(answers.shift());
  board.on("dialog", reply);
  await session.locator("li", { hasText: "Ring light flickering" }).getByRole("button", { name: "Resolve" }).click();
  await expect(session).not.toContainText("Ring light flickering");
  board.off("dialog", reply);
});

test("emergency stop reaches the seller; the session is closed out", async () => {
  const p = jordanPage;
  const mine = card(p, "Vitamin C LIVE — GlowSkin");
  await mine.getByRole("button", { name: "Report incident" }).click();
  await mine.getByLabel("Category").selectOption("compliance");
  await mine.getByLabel("What happened").fill("Seller claimed the serum cures acne");
  await mine.getByLabel(/Emergency stop/).check();
  p.once("dialog", (d) => d.accept());
  await mine.getByRole("button", { name: "Open incident" }).click();
  await expect(p.getByRole("status").filter({ hasText: "Emergency stop sent" })).toBeVisible();

  await sellerPage.goto("/app/notifications");
  await expect(sellerPage.locator("li", { hasText: "Emergency stop" })).toContainText("end the LIVE in the TikTok app now");
  await expect(sellerPage.getByRole("link", { name: /Notifications \(\d+\)/ })).toBeVisible();

  await mine.getByRole("button", { name: "Close out" }).click();
  await mine.getByLabel(/Ended early/).check();
  await mine.getByRole("button", { name: "Close out session" }).click();
  await expect(p.getByRole("status").filter({ hasText: "Closed out" })).toBeVisible();
  await expect(card(rosaPage, "Vitamin C LIVE — GlowSkin")).toHaveCount(0); // gone from the live board
});

test("TikTok Shop results and refunds are imported; brand sees the same figures", async () => {
  const p = jordanPage;
  await p.goto("/app/studio/bookings");
  await p.getByLabel("Status").selectOption("completed");
  await p.getByRole("link", { name: "Vitamin C LIVE — GlowSkin" }).click();
  const orders = ["order_id,placed_at,amount_cents,status", ...Array.from({ length: 8 }, (_, i) => `O${i + 1},${new Date().toISOString()},4000,completed`)].join("\n");
  await p.getByLabel("…or paste the CSV").first().fill(orders);
  await p.getByRole("button", { name: "Import orders" }).click();
  await expect(p.getByRole("status").filter({ hasText: "8 orders imported" })).toBeVisible();
  const results = card(p, "Results");
  await expect(results.getByRole("row", { name: /Attributed GMV/ })).toContainText("$320.00");
  await expect(results.getByRole("row", { name: /Seller commission/ })).toContainText("$32.00");

  await p.getByLabel("…or paste the CSV").last().fill("order_id,refund_cents\nO1,4000");
  await p.getByRole("button", { name: "Import refunds" }).click();
  await expect(results.getByRole("row", { name: /Refunds/ })).toContainText("-$40.00");
  await expect(results.getByRole("row", { name: /Seller commission/ })).toContainText("$28.00");

  await brandPage.goto(campaignUrl);
  const brandResults = card(brandPage, "Results");
  await expect(brandResults.getByRole("row", { name: /Eligible sales/ })).toContainText("$280.00");
  await expect(brandResults.getByRole("row", { name: /Performance fee/ })).toContainText("$19.60"); // 7% × $280
  await expect(brandResults.getByRole("button", { name: "Import orders" })).toHaveCount(0);
});

// ---------------------------------------------------------------- Phase 5: finance
test("finance locks the results; the brand is invoiced production and performance fees", async () => {
  const f = alexPage;
  await f.goto("/app/finance");
  await f.getByRole("row", { name: /Vitamin C LIVE — GlowSkin/ }).getByRole("button", { name: "Lock results" }).click();
  await expect(f.getByRole("status")).toContainText("results locked");

  await brandPage.goto("/app/billing");
  await expect(brandPage.getByRole("row", { name: /production/ })).toContainText("$750.00");
  await expect(brandPage.getByRole("row", { name: /performance/ })).toContainText("$19.60"); // 7% × $280 eligible
  await expect(brandPage.getByRole("row", { name: /performance/ })).toContainText("USD");
});

test("brand disputes the performance invoice; the platform admin credits part of it", async () => {
  const b = brandPage;
  const row = b.getByRole("row", { name: /performance/ });
  await row.getByRole("button", { name: "Dispute" }).click();
  await row.getByLabel("Disputed amount (USD)").fill("19.60");
  await row.getByLabel("What happened").fill("Two orders were placed after the LIVE ended");
  await row.getByRole("button", { name: "Open dispute" }).click();
  await expect(b).toHaveURL(/\/app\/disputes\//);
  const disputeUrl = b.url();

  await adminPage.goto("/app/finance/disputes");
  await adminPage.getByRole("link", { name: "Two orders were placed after the LIVE ended" }).click();
  await adminPage.getByLabel("Decision (both sides see it)").fill("One order was outside the LIVE window");
  await adminPage.getByLabel("Credit to the brand (USD)").fill("5.00");
  await adminPage.getByRole("button", { name: "Decide" }).click();
  await expect(adminPage.getByRole("status")).toContainText("Decided");

  await b.goto(disputeUrl);
  await expect(b.getByText("One order was outside the LIVE window")).toBeVisible();
  await b.goto("/app/billing");
  await expect(b.getByRole("row", { name: /credit note/ })).toContainText("-$5.00");
});

test("invoice paid (sandbox); payout run approved and sent; the seller sees the payout", async () => {
  const f = alexPage;
  await f.goto("/app/finance/invoices");
  await f.getByRole("row", { name: /production/ }).getByRole("button", { name: "Mark paid (sandbox)" }).click();
  await expect(f.getByRole("row", { name: /production/ })).toContainText("paid");

  await f.goto("/app/finance/payouts");
  await expect(f.getByText(/Sandbox: no payment provider is connected/)).toBeVisible();
  await f.getByRole("button", { name: "Build a payout run" }).click();
  await expect(f.getByRole("status")).toContainText("Run created for $28.00"); // commission 10% × $280; no bonus; LIVE under a minute
  await f.getByRole("button", { name: "Approve" }).click();
  await expect(f.getByRole("status")).toContainText("Approved");
  await f.getByRole("button", { name: "Send (sandbox)" }).click();
  await expect(f.getByRole("status")).toContainText("1 paid, 0 failed");
  await f.getByRole("button", { name: "Build a payout run" }).click();
  await expect(f.getByRole("status")).toContainText("Nothing to pay"); // no line is paid twice

  await sellerPage.goto("/app/earnings");
  await expect(card(sellerPage, "Paid")).toContainText("$28.00");
  await expect(sellerPage.locator("section", { hasText: "Payouts" })).toContainText("paid");
});

test("large adjustments need a second person; accounting exports download as CSV", async () => {
  const f = alexPage;
  await f.goto("/app/finance/ledger");
  await f.getByLabel("Amount (USD)").fill("150.00");
  await f.getByLabel("Reason (seller sees it)").fill("Goodwill for the early end");
  await f.getByRole("button", { name: "Add" }).click();
  await expect(f.getByRole("status")).toContainText("a second person must approve");
  await expect(f.getByRole("row", { name: /Goodwill for the early end/ })).toContainText("Needs someone else");

  await rosaPage.goto("/app/finance/ledger");
  await rosaPage.getByRole("row", { name: /Goodwill for the early end/ }).getByRole("button", { name: "Approve" }).click();
  await expect(rosaPage.getByRole("status")).toContainText("Approved and locked");

  await f.reload();
  const [download] = await Promise.all([f.waitForEvent("download"), f.getByRole("link", { name: "Export ledger (CSV)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^ledger-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync(await download.path(), "utf8");
  expect(text).toContain("Goodwill for the early end");
  expect(text).toContain("150.00,USD,locked");
});
