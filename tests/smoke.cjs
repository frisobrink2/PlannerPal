// Start PlannerPal on BASE_URL (default: port 3000) before running this test.
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
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const ready = () =>
      page.getByText("Bewaard in deze browser", { exact: true }).waitFor();
    const dialog = () => page.getByRole("dialog");
    const task = (title) =>
      page
        .locator(".task-card")
        .filter({
          has: page.getByRole("button", { name: title, exact: true }),
        });
    await page.goto(process.env.BASE_URL || "http://localhost:3000");
    await ready();
    assert.equal(await page.locator(".mail-row").count(), 12);
    assert.equal(await page.locator(".task-card").count(), 3);
    // An accepted proposal carries its source and editable fields into the workday.
    await page
      .locator(".mail-row")
      .filter({ hasText: "Offerte voor de nieuwe website" })
      .click();
    await dialog()
      .getByRole("button", { name: "Taakvoorstel aanpassen" })
      .click();
    await dialog()
      .getByLabel("Titel", { exact: true })
      .fill("Offerte website afronden");
    await dialog().getByLabel("Duur (minuten)").fill("45");
    await dialog()
      .getByRole("button", { name: "Taak accepteren", exact: true })
      .click();
    await task("Offerte website afronden")
      .getByRole("button", { name: "Bronmail" })
      .waitFor();
    await task("Offerte website afronden")
      .getByRole("button", { name: "Inplannen", exact: true })
      .click();
    let options = await dialog()
      .locator("select option")
      .evaluateAll((nodes) =>
        nodes.filter((n) => n.value).map((n) => Number(n.value)),
      );
    assert(options.includes(540));
    assert(!options.includes(585));
    assert(!options.includes(600));
    assert(!options.includes(750));
    await dialog().getByLabel("Vrij moment").selectOption("540");
    await dialog()
      .getByRole("button", { name: "Inplannen", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Taak: Offerte website afronden/ })
      .waitFor();
    // Move a scheduled task to another day; preserve the deadline, free the first day.
    await task("Offerte website afronden")
      .getByRole("button", { name: /Verplaatsen/ })
      .click();
    await dialog().getByLabel("Werkdag").fill("2026-10-27");
    await dialog().getByLabel("Vrij moment").selectOption("600");
    await dialog()
      .getByRole("button", { name: "Inplannen", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Werkdag", { exact: true }).inputValue(),
      "2026-10-27",
    );
    await page
      .getByRole("button", {
        name: /Taak: Offerte website afronden, 10:00 tot 10:45/,
      })
      .waitFor();
    await page.getByRole("button", { name: "Vorige dag" }).click();
    assert.equal(await page.locator(".task-card").count(), 3);
    assert.equal(
      await page
        .getByRole("button", { name: /Taak: Offerte website afronden/ })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "Alle open", exact: true }).click();
    await task("Offerte website afronden")
      .getByRole("button", { name: "Bewerk Offerte website afronden" })
      .click();
    assert.equal(
      await dialog().getByLabel("Deadline", { exact: true }).inputValue(),
      "2026-10-27",
    );
    await dialog().getByRole("button", { name: "Annuleren" }).click();
    await page.getByRole("button", { name: "Deze dag", exact: true }).click();
    // Manual creation, invalid overlap after duration change, rescheduling, undo and deletion.
    await page
      .getByRole("button", { name: "Nieuwe taak", exact: true })
      .first()
      .click();
    await dialog()
      .getByLabel("Titel", { exact: true })
      .fill("Eigen administratie");
    await dialog().getByLabel("Duur (minuten)").fill("30");
    await dialog().getByLabel("Tijdstip").selectOption("540");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await task("Eigen administratie")
      .getByText("Zelf toegevoegd", { exact: true })
      .waitFor();
    await task("Eigen administratie")
      .getByRole("button", { name: "Bewerk Eigen administratie" })
      .click();
    await dialog().getByLabel("Duur (minuten)").fill("90");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await dialog().getByRole("alert").waitFor();
    await dialog().getByLabel("Tijdstip").selectOption("");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: /Taak: Eigen administratie/ })
        .count(),
      0,
    );
    await task("Eigen administratie")
      .getByRole("button", { name: "Bewerk Eigen administratie" })
      .click();
    await dialog()
      .getByLabel("Titel", { exact: true })
      .fill("Administratie bijgewerkt");
    await dialog().getByLabel("Werkdag").fill("2026-10-28");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Werkdag", { exact: true }).inputValue(),
      "2026-10-28",
    );
    await task("Administratie bijgewerkt").waitFor();
    await page
      .getByRole("button", { name: "Ongedaan maken", exact: true })
      .click();
    assert.equal(await task("Administratie bijgewerkt").count(), 0);
    await page.getByRole("button", { name: "Alle open", exact: true }).click();
    await task("Eigen administratie")
      .getByRole("button", { name: "Bewerk Eigen administratie" })
      .click();
    await dialog()
      .getByRole("button", { name: "Verwijderen", exact: true })
      .click();
    assert.equal(await task("Eigen administratie").count(), 0);
    await page
      .getByRole("button", { name: "Ongedaan maken", exact: true })
      .click();
    await task("Eigen administratie").waitFor();
    // Editable appointments, blocked collisions, adding/removing a break.
    await page
      .getByRole("button", { name: "Voorbeelddag", exact: true })
      .click();
    await page.getByRole("button", { name: /Afspraak: Weekstart/ }).click();
    await dialog().getByLabel("Titel", { exact: true }).fill("Projectoverleg");
    await dialog().getByLabel("Starttijd").fill("14:00");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await dialog().getByRole("alert").waitFor();
    await dialog().getByLabel("Starttijd").fill("10:30");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: /Afspraak: Projectoverleg, 10:30 tot 11:30/,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Afspraak of pauze toevoegen" })
      .click();
    await dialog().getByLabel("Titel", { exact: true }).fill("Wandelpauze");
    await dialog().getByLabel("Soort").selectOption("Pauze");
    await dialog().getByLabel("Starttijd").fill("16:00");
    await dialog().getByLabel("Duur (minuten)").fill("15");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await page.getByRole("button", { name: /Pauze: Wandelpauze/ }).click();
    await dialog()
      .getByRole("button", { name: "Verwijderen", exact: true })
      .click();
    assert.equal(
      await page.getByRole("button", { name: /Pauze: Wandelpauze/ }).count(),
      0,
    );
    // Workload warning uses the selected day, not the entire task backlog.
    await page
      .getByRole("button", { name: "Nieuwe taak", exact: true })
      .first()
      .click();
    await dialog().getByLabel("Titel", { exact: true }).fill("Groot project");
    await dialog().getByLabel("Duur (minuten)").fill("480");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await page.getByText("meer werk dan ruimte.", { exact: false }).waitFor();
    await task("Groot project")
      .getByRole("button", { name: "Inplannen", exact: true })
      .click();
    await dialog()
      .getByText("Geen aaneengesloten ruimte", { exact: false })
      .waitFor();
    assert(
      await dialog()
        .getByRole("button", { name: "Inplannen", exact: true })
        .isDisabled(),
    );
    await page.keyboard.press("Escape");
    // Draft editing, approval invalidation and persistence of work on multiple days.
    await page
      .getByRole("navigation", { name: "Hoofdnavigatie" })
      .getByRole("button", { name: /Antwoordconcepten/ })
      .click();
    let draft = page
      .locator(".draft-card")
      .filter({ hasText: "Offerte voor de nieuwe website" });
    await draft
      .locator("textarea")
      .fill("Hoi Mark, je ontvangt de offerte morgen.");
    await draft
      .getByRole("button", { name: "Goedkeuren", exact: true })
      .click();
    await page.reload();
    await ready();
    await page
      .getByRole("navigation", { name: "Hoofdnavigatie" })
      .getByRole("button", { name: /Antwoordconcepten/ })
      .click();
    assert.equal(
      await draft.locator("textarea").inputValue(),
      "Hoi Mark, je ontvangt de offerte morgen.",
    );
    await draft.getByText("Goedgekeurd", { exact: true }).first().waitFor();
    await draft.locator("textarea").fill("Nog een aanpassing.");
    await draft.getByText("Concept", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Werkoverzicht", exact: true })
      .click();
    await page.getByRole("button", { name: "Alle open", exact: true }).click();
    await task("Eigen administratie").waitFor();
    await page
      .getByRole("button", { name: /Afspraak: Projectoverleg/ })
      .waitFor();
    await page.getByRole("button", { name: "Volgende dag" }).click();
    await page
      .getByRole("button", { name: /Taak: Offerte website afronden, 10:00/ })
      .waitFor();
    await task("Offerte website afronden")
      .getByRole("button", { name: "Voltooi Offerte website afronden" })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: /Taak: Offerte website afronden/ })
        .count(),
      0,
    );
    await page.reload();
    await ready();
    await page.getByRole("button", { name: "Afgerond", exact: true }).click();
    await task("Offerte website afronden")
      .getByRole("button", { name: "Heropen Offerte website afronden" })
      .waitFor();
    // Old v1 data is migrated without losing prior work. Corrupt data recovers safely.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("plannerpal-demo-v1"));
      s.tasks = s.tasks.filter((t) => t.mailId !== null);
      s.tasks.forEach((t) => delete t.date);
      delete s.blocks;
      localStorage.setItem("plannerpal-demo-v1", JSON.stringify(s));
    });
    await page.reload();
    await ready();
    await page.getByRole("button", { name: "Afgerond", exact: true }).click();
    await task("Offerte website afronden").waitFor();
    await page.evaluate(() =>
      localStorage.setItem(
        "plannerpal-demo-v1",
        JSON.stringify({
          tasks: [{ deadline: "2026-99-99" }],
          drafts: [],
          read: [],
        }),
      ),
    );
    await page.reload();
    await ready();
    assert.equal(await page.locator(".task-card").count(), 3);
    await page
      .getByText("Opgeslagen gegevens zijn ongeldig.", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Voorbeelddata herstellen" })
      .click();
    await dialog()
      .getByRole("button", { name: "Herstellen", exact: true })
      .click();
    await page.getByRole("button", { name: "Melding sluiten" }).click();
    await page.screenshot({
      path: "/tmp/plannerpal-v2-desktop.png",
      fullPage: true,
    });
    // Mobile tabs, manual task and planning actions remain usable without horizontal scrolling.
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page
      .getByRole("navigation", { name: "Werkoverzicht onderdelen" })
      .getByRole("button", { name: "Inbox", exact: true })
      .click();
    await page.locator(".mail-row").first().click();
    await dialog().waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await dialog().count(), 0);
    await page
      .getByRole("navigation", { name: "Werkoverzicht onderdelen" })
      .getByRole("button", { name: "Taken", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nieuwe taak", exact: true })
      .first()
      .click();
    await dialog().getByLabel("Titel", { exact: true }).fill("Mobiele taak");
    await dialog()
      .getByRole("button", { name: "Opslaan", exact: true })
      .click();
    await task("Mobiele taak")
      .getByRole("button", { name: "Inplannen", exact: true })
      .click();
    await dialog().getByLabel("Vrij moment").selectOption("540");
    await dialog()
      .getByRole("button", { name: "Inplannen", exact: true })
      .click();
    assert(
      await page
        .getByRole("button", { name: /Taak: Mobiele taak/ })
        .isVisible(),
    );
    await page
      .getByRole("navigation", { name: "Werkoverzicht onderdelen" })
      .getByRole("button", { name: "Taken", exact: true })
      .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "/tmp/plannerpal-v2-mobile.png",
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: voorstel, handmatige taken, bewerken/verwijderen/undo, meerdere dagen, deadlines, overlapcontrole, afspraken/pauzes, capaciteit, concepten, persistentie, afronden, migratie/herstel, reset en mobiele route.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
