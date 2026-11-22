import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";

// Live end-to-end check of Workshops for a temporary signed-in account (run via
// test:account:live against the development database only). Requires migration
// 202611230001_workshop_bookmarks.sql.
export async function verifyWorkshopsLive(context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(`[${step}] ${page.url()} ${String(error).slice(0, 2600)}`));
  let step = "open";
  const rail = name => page.getByRole("navigation", { name: "Workshop topics" }).getByRole("button", { name });
  const saved = () => page.waitForResponse(response => response.url().endsWith("/api/v1/workshops/bookmarks") && response.status() === 200);
  const cards = () => page.locator("article");
  const card = title => page.locator("article", { has: page.getByRole("button", { name: title, exact: true }) });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto("/workshops");
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1, name: "Workshops" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Workshops", exact: true }).first()).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/hand-checked workshops/)).toBeVisible();

    step = "icon rail";
    await rail("Python").click();
    await expect(rail("Python")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Python" })).toBeVisible();
    await expect(card("CS50's Introduction to Programming with Python")).toBeVisible();
    await expect(card("Web Security Academy")).toHaveCount(0);
    await rail("Python").press("ArrowDown");
    await expect(rail("Cybersecurity")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(card("Web Security Academy")).toBeVisible();
    await page.mouse.move(900, 20);
    await rail("Python").hover();
    await expect(page.locator("body > div", { hasText: /^Python$/ })).toBeVisible();

    step = "search and filters combine";
    await rail("All Workshops").click();
    await page.getByLabel("Search workshops").fill("HARVARD");
    await expect(card("CS50's Introduction to Programming with Python")).toBeVisible();
    await expect(card("Bandit Wargame")).toHaveCount(0);
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page.getByRole("radio", { name: "Intermediate" }).check();
    await expect(cards()).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Filters, 1 active" })).toBeFocused();
    await rail("Python").click();
    await expect(page.getByRole("heading", { name: "No workshops match" })).toBeVisible();
    await page.getByRole("button", { name: "Reset Filters" }).click();
    await expect(rail("All Workshops")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Search workshops")).toHaveValue("");

    step = "bookmarks persist in the account";
    let request = saved();
    await page.getByRole("button", { name: "Save Bandit Wargame" }).click();
    await request;
    await page.reload();
    await expect(rail("My Saved, 1 available")).toBeVisible();
    await rail("My Saved, 1 available").click();
    await expect(cards()).toHaveCount(1);
    await page.route("**/api/v1/workshops/bookmarks", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Saving is unavailable." } }) }));
    await page.getByRole("button", { name: "Save Bandit Wargame" }).click();
    await expect(page.getByText("Saving is unavailable.")).toBeVisible();
    await expect(cards()).toHaveCount(1);
    await page.unroute("**/api/v1/workshops/bookmarks");

    step = "details, deep link and history";
    await rail("All Workshops").click();
    await page.getByLabel("Search workshops").fill("docker");
    await page.getByRole("button", { name: "Get Started with Docker Containers", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Get Started with Docker Containers" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\?workshop=docker-get-started$/);
    await expect(dialog.getByRole("link", { name: /^Start Learning/ })).toHaveAttribute("rel", "noopener noreferrer");
    await expect(dialog.getByRole("link", { name: "Docker", exact: true })).toHaveAttribute("href", "/learning-roadmap/docker");
    await expect(dialog.getByText("Google Calendar")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/workshops$/);
    await expect(page.getByLabel("Search workshops")).toHaveValue("docker");
    await page.goForward();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await page.goto("/workshops?topic=python&workshop=cs50p");
    await expect(page.getByRole("dialog", { name: "CS50's Introduction to Programming with Python" })).toBeVisible();
    await page.getByRole("button", { name: "Close details" }).click();
    await expect(page).toHaveURL(/\/workshops\?topic=python$/);
    await page.goto("/workshops?workshop=does-not-exist");
    await expect(page.getByText("That workshop is no longer available.")).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page).toHaveURL(/\/workshops$/);

    step = "private submission";
    await page.getByRole("button", { name: "Submit workshop" }).click();
    const modal = page.getByRole("dialog", { name: "Add a workshop" });
    await modal.getByRole("button", { name: "Continue" }).click();
    await expect(modal.getByText("Enter a full address that starts with https://")).toBeVisible();
    await expect(modal.getByLabel("Workshop link")).toBeFocused();
    await modal.getByLabel("Workshop link").fill("https://docs.docker.com/learn/paths/get-started-with-docker-containers/?utm_source=x");
    await modal.getByLabel("Title").fill("Another Docker course");
    await modal.getByLabel("Topic").selectOption("Cloud & DevOps");
    await modal.getByLabel("Format").selectOption("Self-Paced / Recorded");
    await modal.getByRole("button", { name: "Continue" }).click();
    await expect(modal.getByText("This workshop is already in the list.")).toBeVisible();
    await modal.getByLabel("Workshop link").fill("https://example.com/my-course");
    await modal.getByRole("button", { name: "Continue" }).click();
    await modal.getByLabel("What will you be able to do?").fill("Write <b>useful</b> scripts.");
    await modal.getByLabel("Level").selectOption("Beginner");
    await modal.getByLabel("Minutes").fill("90");
    await modal.getByLabel("Cost").selectOption("Free");
    await modal.getByRole("button", { name: "Add workshop" }).click();
    await expect(modal).toHaveCount(0);
    await page.getByLabel("Search workshops").fill("another docker");
    await expect(page.getByText("Added by you")).toBeVisible();
    await expect(page.getByText("Write <b>useful</b> scripts.")).toBeVisible();
    await page.reload();
    await page.getByLabel("Search workshops").fill("another docker");
    await page.getByRole("button", { name: "Another Docker course", exact: true }).click();
    await page.getByRole("button", { name: "Remove it" }).click();
    await page.getByLabel("Search workshops").fill("another docker");
    await expect(page.getByRole("heading", { name: "No workshops match" })).toBeVisible();

    step = "event lifecycle with a controlled clock";
    const event = "Durable Execution for .NET Workflows with Dapr, Aspire and Diagrid";
    for (const [time, check] of [
      ["2026-12-09T16:30:00Z", async () => {
        await expect(page.getByRole("timer")).toBeVisible();
        await page.getByRole("button", { name: event, exact: true }).first().click();
        const details = page.getByRole("dialog", { name: event });
        await expect(details.getByRole("link", { name: /^Google Calendar/ })).toHaveAttribute("href", /dates=20261209T170000Z%2F20261209T180000Z/);
        const download = page.waitForEvent("download");
        await details.getByRole("button", { name: "Download .ics" }).click();
        const ics = await readFile(await (await download).path(), "utf8");
        assert.ok(ics.includes("DTSTART:20261209T170000Z") && ics.includes("END:VCALENDAR"));
        await page.keyboard.press("Escape");
        // The page stays open while the session starts, then ends.
        await page.clock.fastForward("31:00");
        await expect(page.getByText("Happening Now").first()).toBeVisible();
        await expect(page.getByRole("timer")).toHaveCount(0);
        await page.clock.fastForward("01:01:00");
        await expect(page.getByRole("button", { name: event, exact: true })).toHaveCount(0);
      }],
      ["2026-12-09T17:30:00Z", async () => { await expect(page.getByText("Happening Now").first()).toBeVisible(); }],
      ["2026-12-09T18:00:01Z", async () => { await expect(page.getByRole("button", { name: event, exact: true })).toHaveCount(0); }]
    ]) {
      const timed = page;
      await timed.clock.install({ time: new Date(time) });
      await timed.goto("/workshops");
      await timed.clock.runFor(2000);
      await check();
    }
    await page.close();

    step = "responsive layout";
    const view = await context.newPage();
    for (const width of [320, 390, 768, 1440]) {
      await view.setViewportSize({ width, height: 900 });
      for (const path of ["/workshops", "/workshops?workshop=cs50p"]) {
        await view.goto(path);
        await expect(view.getByRole("heading", { level: 1, name: "Workshops", includeHidden: true })).toBeVisible();
        assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow on ${path} at ${width}px`);
      }
      await view.goto("/workshops");
      const strip = await view.getByRole("navigation", { name: "Workshop topics" }).evaluate(element => getComputedStyle(element.querySelector("ul")).flexDirection);
      assert.equal(strip, width <= 760 ? "row" : "column");
      const small = await view.evaluate(() => [...document.querySelectorAll("nav[aria-label='Workshop topics'] button")].filter(button => button.getBoundingClientRect().width < 44 || button.getBoundingClientRect().height < 44).length);
      assert.equal(small, 0, "touch targets");
    }
    // Reflow at 200% text.
    await view.setViewportSize({ width: 390, height: 900 });
    await view.goto("/workshops");
    await view.addStyleTag({ content: "html { font-size: 200% }" });
    assert.equal(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "overflow with larger text");
    // A short screen scrolls the rail on its own.
    await view.setViewportSize({ width: 1280, height: 380 });
    await view.goto("/workshops");
    const scrolls = await view.locator("nav[aria-label='Workshop topics'] ul").evaluate(element => { element.scrollTop = 999; return element.scrollTop > 0; });
    assert.equal(scrolls, true, "rail scrolls independently");

    step = "roadmap link";
    await view.setViewportSize({ width: 1440, height: 1000 });
    await view.goto("/learning-roadmap/docker");
    await view.getByRole("link", { name: /^Get Started with Docker Containers/ }).click();
    await expect(view.getByRole("dialog", { name: "Get Started with Docker Containers" })).toBeVisible();

    step = "API";
    const put = (data, headers) => view.request.put("/api/v1/workshops/bookmarks", { data, headers });
    assert.equal((await put({ workshopId: "cs50p", saved: true }, { origin: "https://evil.example" })).status(), 403);
    assert.equal((await put({ workshopId: "not-real", saved: true })).status(), 404);
    assert.equal((await put({ workshopId: "../x", saved: true })).status(), 400);
    const catalog = await (await view.request.get("/api/v1/workshops")).json();
    assert.ok(catalog.workshops.length >= 20 && catalog.sources.length >= 2);
    console.log(`Workshop sources: ${catalog.sources.map(source => `${source.label} ${source.state} (${source.count})`).join("; ")}`);
    assert.equal((await put({ workshopId: "overthewire-bandit", saved: false })).status(), 200);
    await view.close();
    assert.deepEqual(errors, []);
    console.log("PASS: workshops navigation, icon rail (mouse, keyboard, tooltip), search, combined filters, reset, account bookmarks with rollback, details, deep links and history, private submission, countdown to live to ended, calendar export, 320-1440px layouts, larger text, roadmap link and API.");
  } catch (error) {
    await page.screenshot({ path: "test-results/workshops-failure.png", fullPage: true }).catch(() => {});
    error.message = `[workshops step: ${step}] ${error.message}`;
    throw error;
  } finally { await page.close().catch(() => {}); }
}
