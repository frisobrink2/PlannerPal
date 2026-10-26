const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (require("fs").existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined),
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const base = process.env.BASE_URL || "http://localhost:3000";
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/assistant");
    await page
      .getByText("Inloggen geeft ons nog geen toegang tot je mail of agenda.")
      .waitFor();
    assert(
      await page.getByRole("link", { name: "Voor de beheerder" }).isVisible(),
    );
    assert.equal(
      await page
        .getByRole("button", { name: /Doorgaan met Google/ })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: /Doorgaan met Microsoft/ })
        .isDisabled(),
      true,
    );
    assert(!(await page.locator("body").innerText()).includes("DATABASE_URL"));
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.equal(
      await page
        .locator('meta[name="apple-mobile-web-app-capable"]')
        .getAttribute("content"),
      "yes",
    );
    await page.screenshot({
      path: "/tmp/plannerpal-signin-iphone.png",
      fullPage: true,
    });
    const manifest = await (
      await page.request.get(base + "/manifest.webmanifest")
    ).json();
    assert.equal(manifest.start_url, "/assistant");
    assert.equal(manifest.display, "standalone");
    for (const icon of manifest.icons)
      assert.equal((await page.request.get(base + icon.src)).status(), 200);
    assert.equal((await page.request.get(base + "/api/sync")).status(), 401);
    assert.equal(
      (
        await page.request.post(base + "/api/drafts", {
          headers: { Origin: "https://evil.example" },
          data: { id: "fixture" },
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await page.request.post(base + "/api/drafts", {
          headers: { Origin: "https://planner-pal.vercel.app" },
          data: { id: "fixture" },
        })
      ).status(),
      401,
    );
    for (const path of ["/api/auth/callback", "/api/auth/callback/microsoft"]) {
      const callback = await page.request.get(
        base + path + "?code=invalid&state=invalid",
        { maxRedirects: 0 },
      );
      assert.equal(callback.status(), 307);
      assert(callback.headers().location.endsWith("/assistant?auth=failed"));
    }
    await page.goto(base + "/admin");
    await page
      .getByRole("heading", { name: "Installatie voor de beheerder" })
      .waitFor();
    await page.goto(base + "/privacy");
    await page
      .getByRole("heading", { name: "Jouw gegevens in PlannerPal" })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: iPhone-aanmeldpagina, geen technische gebruikersvelden, gescheiden beheer, privacy, PWA, geen acties zonder login en beide ongeldige OAuth-callbacks.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
