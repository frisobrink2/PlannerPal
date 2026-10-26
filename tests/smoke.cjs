// Start the application before running this browser smoke test.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (require("node:fs").existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://localhost:3000");
  await page.getByText("Je wijzigingen blijven in deze browser").waitFor();
  assert.equal(await page.locator(".mail-row").count(), 12);
  await page
    .locator(".mail-row")
    .filter({ hasText: "Offerte voor de nieuwe website" })
    .click();
  await page
    .getByRole("button", { name: "Voorstel bekijken & aanpassen" })
    .click();
  await page
    .getByLabel("Taak", { exact: true })
    .fill("Offerte website definitief maken");
  await page.getByLabel("Duur (minuten)").fill("45");
  await page
    .getByRole("button", { name: "Taak accepteren", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bekijk de taak", exact: true })
    .click();
  const task = page
    .locator(".task-card")
    .filter({ hasText: "Offerte website definitief maken" });
  await task.waitFor();
  await task.getByRole("button", { name: "Inplannen", exact: true }).click();
  const options = await page
    .locator("select option")
    .evaluateAll((nodes) =>
      nodes.filter((n) => n.value).map((n) => Number(n.value)),
    );
  assert(options.includes(540));
  assert(!options.includes(585));
  assert(!options.includes(600));
  assert(!options.includes(750));
  await page.getByLabel("Vrij moment").selectOption("540");
  await page.getByRole("button", { name: "Toevoegen aan dagplanning" }).click();
  await page
    .locator(".event")
    .filter({ hasText: "Offerte website definitief maken" })
    .waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Antwoordconcepten" })
    .click();
  const draft = page
    .locator(".draft-card")
    .filter({ hasText: "Offerte voor de nieuwe website" });
  await draft
    .locator("textarea")
    .fill("Hoi Mark, je ontvangt de offerte morgen. Groet!");
  await draft
    .getByRole("button", { name: "Concept goedkeuren", exact: true })
    .click();
  await page.reload();
  await page.getByText("Je wijzigingen blijven in deze browser").waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Antwoordconcepten" })
    .click();
  assert.equal(
    await draft.locator("textarea").inputValue(),
    "Hoi Mark, je ontvangt de offerte morgen. Groet!",
  );
  await draft.getByText("Goedgekeurd", { exact: true }).first().waitFor();
  await draft.locator("textarea").fill("Aangepast na goedkeuring");
  await draft.getByText("Concept", { exact: true }).waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dagplanning" })
    .click();
  await page
    .locator(".event")
    .filter({ hasText: "Offerte website definitief maken" })
    .waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Taken" })
    .click();
  await task
    .getByRole("button", { name: "Voltooi Offerte website definitief maken" })
    .click();
  await page.reload();
  await page.getByText("Je wijzigingen blijven in deze browser").waitFor();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Taken" })
    .click();
  await task
    .getByRole("button", { name: "Heropen Offerte website definitief maken" })
    .waitFor();
  await page
    .getByRole("button", { name: "Voorbeelddata herstellen", exact: true })
    .first()
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Voorbeelddata herstellen", exact: true })
    .click();
  assert.equal(await page.locator(".task-card").count(), 3);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Inbox" })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/plannerpal-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.locator(".mail-row").first().click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/plannerpal-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 12 mails; voorstel aanpassen/accepteren; overlapvrije planning; concept bewerken/goedkeuren; herladen; afronden; reset; mobiel; geen browserfouten.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
