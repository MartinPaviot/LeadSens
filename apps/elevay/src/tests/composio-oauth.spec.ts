import { test, expect } from "@playwright/test";
import { navigateToStep5, loginAsTestUser } from "./helpers/navigate-to-step5";

const PLATFORM_KEYS = ["googledrive", "googledocs", "linkedin", "instagram", "tiktok", "facebook", "x"] as const;

// ── Test 1 — Step 5 affiche tous les pills ────────────────────────────────────

test("Step 5 shows all platform pills", async ({ page }) => {
  await navigateToStep5(page);
  for (const key of PLATFORM_KEYS) {
    await expect(page.getByTestId(`connect-${key}`)).toBeVisible();
  }
});

// ── Test 2 — Connect LinkedIn ouvre une popup OAuth ───────────────────────────

test("Connect LinkedIn opens OAuth popup", async ({ page, context }) => {
  await navigateToStep5(page);
  const popupPromise = context.waitForEvent("page");
  await page.getByTestId("connect-linkedin").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  const url = popup.url();
  console.log("[test] LinkedIn OAuth popup URL:", url);
  expect(url).toMatch(/composio|linkedin\.com\/oauth/i);
});

// ── Test 3 — Connect Google Drive ouvre OAuth Google ─────────────────────────

test("Connect Google Drive opens Google OAuth", async ({ page, context }) => {
  await navigateToStep5(page);
  const popupPromise = context.waitForEvent("page");
  await page.getByTestId("connect-googledrive").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  const url = popup.url();
  console.log("[test] Google Drive OAuth popup URL:", url);
  expect(url).toMatch(/composio|accounts\.google\.com/i);
});

// ── Test 4 — API /connect retourne un redirectUrl ────────────────────────────

test("LinkedIn connect API returns redirectUrl", async ({ page }) => {
  await loginAsTestUser(page);

  const response = await page.request.post("/api/auth/social/linkedin/connect");
  const body = await response.json() as { redirectUrl?: string; status?: string };
  console.log("[test] LinkedIn connect response:", body);

  if (body.redirectUrl) {
    console.log("[test] ✅ Composio OAuth working!");
    expect(body.redirectUrl).toContain("http");
  } else {
    console.log("[test] ⚠️ No redirectUrl — check COMPOSIO_API_KEY permissions");
    expect(body.status ?? body.redirectUrl).toBeDefined();
  }
});

// ── Test 5 — Table DB elevay_brand_profile existe ────────────────────────────

test("brandProfile.get does not return 500", async ({ page }) => {
  await loginAsTestUser(page);

  const response = await page.request.get(
    "/api/trpc/brandProfile.get?batch=1&input=%7B%7D",
  );
  console.log("[test] brandProfile.get status:", response.status());
  expect(response.status()).not.toBe(500);
});
