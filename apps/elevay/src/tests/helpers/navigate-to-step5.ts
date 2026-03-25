import type { Page } from "@playwright/test";

const TEST_PASSWORD = "PlaywrightTest123!";

function testEmail() {
  return `test-${Date.now()}@example.com`;
}

/** Crée un compte et navigue jusqu'au Step 5 (social connections). */
export async function navigateToStep5(page: Page) {
  const email = testEmail();

  // ── Signup ────────────────────────────────────────────────────────────────
  await page.goto("/signup");
  await page.locator("#firstName").fill("Test");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Get Started Free" }).click();
  await page.waitForURL("**/chat", { timeout: 45_000 });

  // ── Attendre Step 1 de l'onboarding ──────────────────────────────────────
  await page.waitForSelector('[data-testid="onboarding-modal"]', { timeout: 20_000 });
  const modal = page.getByTestId("onboarding-modal");

  // ── Step 1 — Brand Identity ───────────────────────────────────────────────
  // brand_url requis (URL valide) + brand_name requis (min 1 char)
  await modal.getByPlaceholder("https://mysite.com").fill("https://www.louispion.fr/");
  await modal.getByPlaceholder("e.g. Acme Corp").fill("Louis Pion");
  // Laisser l'auto-detect s'exécuter (optionnel, 2s)
  await page.waitForTimeout(2000);
  await modal.getByRole("button", { name: "Next", exact: true }).click();

  // ── Step 2 — Competitors ──────────────────────────────────────────────────
  // Si auto-detect a rempli les competitors, Next passera directement.
  // Sinon on ajoute un competitor manuellement.
  await page.waitForTimeout(500);

  // Vérifier si des competitors existent déjà (champ placeholder "Name")
  const competitorNameInputs = modal.getByPlaceholder("Name");
  const count = await competitorNameInputs.count();

  if (count === 0) {
    // Aucun competitor pré-rempli — en ajouter un manuellement
    await modal.getByText("+ Add a competitor").click();
    await page.waitForTimeout(300);
  }

  // Remplir le premier competitor si name ou url est vide
  const firstNameInput = competitorNameInputs.first();
  const firstUrlInput = modal.getByPlaceholder("https://competitor.com").first();

  const nameVal = await firstNameInput.inputValue();
  if (!nameVal) await firstNameInput.fill("Maty");

  const urlVal = await firstUrlInput.inputValue();
  if (!urlVal || !urlVal.startsWith("http")) await firstUrlInput.fill("https://www.maty.com");

  await modal.getByRole("button", { name: "Next", exact: true }).click();

  // ── Step 3 — Analysis Parameters ─────────────────────────────────────────
  await page.waitForTimeout(500);

  // Remplir les champs requis s'ils sont vides
  const countryInput = modal.getByPlaceholder("France");
  if (!(await countryInput.inputValue())) await countryInput.fill("France");

  const langInput = modal.getByPlaceholder("English");
  if (!(await langInput.inputValue())) await langInput.fill("French");

  const primaryInput = modal.getByPlaceholder("HR software");
  if (!(await primaryInput.inputValue())) await primaryInput.fill("bijouterie");

  const secondaryInput = modal.getByPlaceholder("HRIS SMB");
  if (!(await secondaryInput.inputValue())) await secondaryInput.fill("montre luxe");

  // Sélectionner au moins 1 channel si aucun n'est sélectionné
  // On clique sur "SEO" (toujours présent dans CHANNEL_OPTIONS)
  const seoBtn = modal.getByRole("button", { name: "SEO" });
  await seoBtn.click();

  await modal.getByRole("button", { name: "Next", exact: true }).click();

  // ── Step 4 — Report Settings (pas de validation) ──────────────────────────
  await page.waitForTimeout(500);
  await modal.getByRole("button", { name: "Next", exact: true }).click();

  // ── Step 5 — Connect Your Tools ───────────────────────────────────────────
  // Wait for social status loading to finish, then for the pills to appear
  await page.waitForSelector('[data-testid="onboarding-modal"] .animate-spin', {
    state: "detached",
    timeout: 15_000,
  }).catch(() => {
    // spinner may have already disappeared — that's fine
  });
  await page.waitForSelector('[data-testid="connect-linkedin"]', { timeout: 15_000 });
}

/** Crée un compte frais et va sur /chat (pour les tests API). */
export async function loginAsTestUser(page: Page) {
  const email = testEmail();
  await page.goto("/signup");
  await page.locator("#firstName").fill("Test");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Get Started Free" }).click();
  await page.waitForURL("**/chat", { timeout: 45_000 });
}
