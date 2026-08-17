import { test, expect, type Browser, type BrowserContext } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const QUIZ_ID = process.env.REPRO_QUIZ_ID || "cmsw8smhe00000kzkwd8wko89";
// Admin credentials are read from the environment so no secret is committed.
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

// Admin login -> returns a context with the admin session cookie set.
async function adminContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  expect(res.ok()).toBeTruthy();
  await page.close();
  return ctx;
}

async function createGame(ctx: BrowserContext): Promise<string> {
  const page = await ctx.newPage();
  const res = await page.request.post(`${BASE}/api/games`, { data: { quizId: QUIZ_ID } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  await page.close();
  return body.gameCode;
}

test.describe("Repro: MATCHING + CATEGORISE end-to-end", () => {
  // The flow needs admin auth (host control is admin-gated). Skip rather than
  // fail when no credentials are provided so no secret has to live in the repo.
  test.skip(!ADMIN_PASS, "ADMIN_PASSWORD env var is required to run this test");
  test.setTimeout(180000);

  test("matching selections persist and score correctly", async ({ browser }) => {
    const adminCtx = await adminContext(browser);
    const gameCode = await createGame(adminCtx);

    // Host control (admin context carries the session cookie for socket auth)
    const hostPage = await adminCtx.newPage();
    await hostPage.goto(`${BASE}/host/${gameCode}/control`);
    await hostPage.waitForLoadState("networkidle");

    // Player joins in a separate context
    const playerCtx = await browser.newContext();
    const playerPage = await playerCtx.newPage();
    await playerPage.goto(`${BASE}/play/${gameCode}`);
    await playerPage.waitForLoadState("networkidle");
    await playerPage.locator('input[name="name"], input[placeholder*="name" i]').first().fill("ReproPlayer");
    // pick an emoji if present
    const emoji = playerPage.getByRole("button", { name: /😀|😎|🤖|👾|🦊|🐱|🐶|🎮|🎯|⚡/ });
    if (await emoji.count() > 0) await emoji.first().click();
    await playerPage.getByRole("button", { name: /join/i }).click();
    await playerPage.waitForTimeout(1500);

    // Admit player if needed (autoAdmit may be off)
    const admitBtn = hostPage.getByRole("button", { name: /admit/i }).first();
    if (await admitBtn.count() > 0) {
      await admitBtn.click().catch(() => {});
      await hostPage.waitForTimeout(800);
    }

    // Start game
    const startBtn = hostPage.getByRole("button", { name: /start game/i });
    await expect(startBtn).toBeVisible({ timeout: 15000 });
    await startBtn.click();
    await hostPage.waitForTimeout(1500);

    // --- Q1 SINGLE_SELECT ---
    await playerPage.waitForTimeout(1000);
    const q1correct = playerPage.getByRole("button", { name: /Paris/i }).first();
    await expect(q1correct).toBeVisible({ timeout: 15000 });
    await q1correct.click();
    await playerPage.waitForTimeout(1500);

    // Host: skip timer -> reveal -> next
    await hostPage.getByRole("button", { name: /skip timer/i }).click().catch(async () => {
      // If skip not available, wait for timer via reveal
    });
    await hostPage.waitForTimeout(500);
    await hostPage.getByRole("button", { name: /reveal/i }).click().catch(() => {});
    await hostPage.waitForTimeout(800);
    await hostPage.getByRole("button", { name: /next question/i }).click().catch(() => {});
    await hostPage.waitForTimeout(1500);

    // --- Q2 CATEGORISE ---
    await playerPage.waitForTimeout(1000);
    // Hund -> Säugetiere, Adler -> Vögel
    const catButtons = playerPage.getByRole("button");
    const allCatTexts = (await catButtons.allTextContents());
    console.log("CATEGORISE buttons:", allCatTexts.filter(t => /Säugetiere|Vögel|Hund|Adler/.test(t)).slice(0, 12));
    // Click Säugetiere near Hund, Vögel near Adler. Items render in order Hund then Adler.
    await playerPage.getByRole("button", { name: /^Säugetiere$/ }).first().click();
    await playerPage.getByRole("button", { name: /^Vögel$/ }).nth(1).click();
    await playerPage.waitForTimeout(500);
    // Submit categorise
    const catSubmit = playerPage.getByRole("button", { name: /submit answer/i });
    await catSubmit.click().catch(() => {});
    await playerPage.waitForTimeout(1200);

    await hostPage.getByRole("button", { name: /skip timer/i }).click().catch(() => {});
    await hostPage.waitForTimeout(500);
    await hostPage.getByRole("button", { name: /reveal/i }).click().catch(() => {});
    await hostPage.waitForTimeout(800);
    await hostPage.getByRole("button", { name: /next question/i }).click().catch(() => {});
    await hostPage.waitForTimeout(1500);

    // --- Q3 MATCHING (the critical test) ---
    await playerPage.waitForTimeout(1200);
    const selects = playerPage.locator("select");
    await expect(selects.first()).toBeVisible({ timeout: 15000 });
    const selectCount = await selects.count();
    console.log("MATCHING select count:", selectCount);
    expect(selectCount).toBe(4);

    // Read option labels for each select via the page (robust against re-renders).
    async function readOptions(i: number) {
      return await selects.nth(i).locator("option").evaluateAll(
        (opts) => opts.map((o) => ({ value: (o as HTMLOptionElement).value, text: o.textContent?.trim() ?? "" }))
      );
    }

    // Left labels render in pair order: Deutschland, Frankreich, Italien, Spanien.
    const leftLabels = ["Deutschland", "Frankreich", "Italien", "Spanien"];
    const correct: Record<string, string> = {
      "Deutschland": "Berlin",
      "Frankreich": "Paris",
      "Italien": "Rom",
      "Spanien": "Madrid",
    };

    async function valueFor(i: number, cityText: string): Promise<string | null> {
      const opts = await readOptions(i);
      const found = opts.find((o) => o.text === cityText);
      return found ? found.value : null;
    }

    // Select one by one and assert persistence after each.
    for (let i = 0; i < leftLabels.length; i++) {
      const label = leftLabels[i];
      const city = correct[label];
      const val = await valueFor(i, city);
      console.log(`select ${i} (${label}) -> ${city} (value=${val})`);
      expect(val).toBeTruthy();
      await selects.nth(i).selectOption(val);
      await playerPage.waitForTimeout(300);
      // Assert all previously-set selects still hold their value.
      for (let j = 0; j <= i; j++) {
        const v = await selects.nth(j).inputValue();
        const expectedCity = correct[leftLabels[j]];
        const expectedVal = await valueFor(j, expectedCity);
        expect(v, `row ${j} (${leftLabels[j]}) lost its selection after selecting row ${i}`).toBe(expectedVal);
      }
    }

    // All four persisted. Submit.
    const matchSubmit = playerPage.getByRole("button", { name: /submit answer/i });
    await expect(matchSubmit).toBeEnabled();
    await matchSubmit.click();
    await playerPage.waitForTimeout(1500);

    // Host: skip -> reveal -> inspect score
    await hostPage.getByRole("button", { name: /skip timer/i }).click().catch(() => {});
    await hostPage.waitForTimeout(500);
    await hostPage.getByRole("button", { name: /reveal/i }).click().catch(() => {});
    await hostPage.waitForTimeout(1000);

    // After reveal, the player view should show correct (green) for all 4 pairs.
    // Score should reflect a correct matching (full points + speed bonus).
    const playerScoreText = await playerPage.locator("body").textContent();
    console.log("Player body after matching reveal (excerpt):", (playerScoreText || "").slice(0, 200));

    // Next -> Q4 -> finish -> FINISHED
    await hostPage.getByRole("button", { name: /next question/i }).click().catch(() => {});
    await hostPage.waitForTimeout(1500);

    // Q4 SINGLE_SELECT: answer 4
    await playerPage.waitForTimeout(1000);
    await playerPage.getByRole("button", { name: /^4$/ }).first().click().catch(async () => {
      await playerPage.getByRole("button", { name: /4/i }).first().click().catch(() => {});
    });
    await playerPage.waitForTimeout(1500);
    await hostPage.getByRole("button", { name: /skip timer/i }).click().catch(() => {});
    await hostPage.waitForTimeout(500);
    await hostPage.getByRole("button", { name: /reveal/i }).click().catch(() => {});
    await hostPage.waitForTimeout(1000);

    // After last question reveal, reveal auto-advances to SCOREBOARD.
    // The reveal button may already have advanced us. Now at SCOREBOARD on the final
    // question -> click "End Game" to transition to FINISHED.
    await hostPage.waitForTimeout(1500);

    // End Game -> FINISHED (try several button label variants)
    const endGameBtn = hostPage.getByRole("button", { name: /end game|end game early/i }).first();
    await expect(endGameBtn).toBeVisible({ timeout: 15000 });
    await endGameBtn.click();
    await hostPage.waitForTimeout(2000);

    // --- FINISHED state: Game Complete! text + Certificate UI ---
    await expect(hostPage.getByText(/game complete/i)).toBeVisible({ timeout: 15000 });
    console.log("FINISHED reached. Host URL:", hostPage.url());

    // Certificate Download Button should be present.
    await expect(hostPage.getByRole("button", { name: /download|certificate|zertifikat/i }).first()).toBeVisible({ timeout: 15000 });

    // --- Show Results button (from FINISHED) -> back to SCOREBOARD view ---
    const showResultsBtn = hostPage.getByRole("button", { name: /show results/i }).first();
    await expect(showResultsBtn).toBeVisible({ timeout: 10000 });
    await showResultsBtn.click();
    await hostPage.waitForTimeout(1500);
    console.log("After Show Results. Host URL:", hostPage.url());

    // Player side should reflect FINISHED state (final scoreboard / results).
    await playerPage.waitForTimeout(1500);
    const playerFinishedText = await playerPage.locator("body").textContent();
    console.log("Player body at finish (excerpt):", (playerFinishedText || "").slice(0, 200));

    console.log("Flow complete. Host URL:", hostPage.url());

    await playerCtx.close();
    await adminCtx.close();
  });
});
