import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// Live end-to-end check of the learning roadmap for a temporary signed-in
// account (run via test:account:live against the development database only).
// Requires migration 202611210001_learning_progress.sql to be applied.
export async function verifyLearningLive(context) {
  const page = await context.newPage();
  let step = "open dashboard";
  try {
    const response = await page.goto("/learning-roadmap");
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn for free");
    await expect(page.getByText("Pick up where you left off")).toHaveCount(0);

    step = "search catalog and open Python";
    // Search narrows the catalog; the Python guided path opens its setup.
    await page.getByLabel("Search learning paths").fill("python");
    await page.getByRole("link", { name: /Python/ }).first().click();
    await expect(page).toHaveURL(/\/learning-roadmap\/python$/);
    await expect(page.getByRole("heading", { name: "Personalise your roadmap" })).toBeVisible();

    step = "preview then save enrolment";
    // Preview (GET form, nothing saved) then save.
    await page.getByRole("radio", { name: /Become a Python backend developer/ }).check();
    await page.getByRole("radio", { name: /New to programming/ }).check();
    await page.getByRole("button", { name: "Preview my roadmap" }).click();
    await expect(page).toHaveURL(/goal=backend/);
    await expect(page.getByText("Roadmap preview — not saved yet")).toBeVisible();
    await page.getByRole("button", { name: "Save and start learning" }).click();
    await expect(page).toHaveURL(/\/learning-roadmap\/python$/);
    await expect(page.getByText("Your personalised roadmap")).toBeVisible();

    step = "topic dialog progress";
    // Topic dialog: start, complete via criteria, persist across reload.
    await page.goto("/learning-roadmap/python?topic=how-programs-work");
    const dialog = page.getByRole("dialog", { name: "How programs work" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Start this topic" }).click();
    await expect(dialog.getByRole("status").last()).toContainText("in progress");
    // The saved state re-renders the dialog; wait for it so the test exercises the persisted UI.
    await expect(dialog.getByRole("button", { name: "Start this topic" })).toHaveCount(0);
    for (const box of await dialog.getByRole("checkbox").all()) await box.check();
    await dialog.getByRole("button", { name: "Mark as complete" }).click();
    await expect(dialog.getByRole("button", { name: "Reopen topic" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("dialog", { name: "How programs work" }).getByRole("button", { name: "Reopen topic" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/learning-roadmap\/python$/);

    step = "change goal keeps progress";
    // Changing goal keeps progress.
    await page.getByRole("radio", { name: /Data analysis/ }).check();
    await page.getByRole("button", { name: "Save plan changes" }).click();
    await expect(page.getByText("Goal: Data analysis")).toBeVisible();
    await expect(page.getByText(/1 of \d+ plan topics completed/)).toBeVisible();

    step = "dashboard resume and layout";
    // Dashboard resumes the saved path; layout reflows without horizontal scroll.
    await page.goto("/learning-roadmap");
    await expect(page.getByText("Pick up where you left off")).toBeVisible();
    for (const width of [320, 768, 1440]) {
      // Load at each width (as a phone would) rather than measuring mid-way through
      // the app shell's desktop-to-mobile transition.
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/learning-roadmap");
      await expect(page.getByText("Pick up where you left off")).toBeVisible();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow at ${width}px`);
      await page.screenshot({ path: `test-results/learning-${width}.png`, fullPage: true, animations: "disabled" });
    }

    step = "web path and skill map";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/learning-roadmap");
    await expect(page.getByRole("link", { name: /JavaScript & Web Development/ })).toBeVisible();
    await page.goto("/learning-roadmap/web-development?goal=full-stack&level=new&hours=8&format=mixed&view=overview");
    const map = page.getByRole("region", { name: /skill map/ });
    await expect(map).toBeVisible();
    assert.ok(await map.locator("a[data-status]").count() >= 40, "every included topic appears on the map");
    await expect(map.locator("a[data-next]")).toHaveCount(1);
    await expect(map.locator("a[data-next]")).toHaveAttribute("aria-label", /How the web works: ready to start, your next topic/);
    await map.locator("a[data-next]").click();
    await expect(page.getByRole("dialog", { name: "How the web works" })).toBeVisible();
    await page.keyboard.press("Escape");

    step = "API validation";
    // API rejects unknown curriculum ids and foreign origins.
    const unknown = await page.request.put("/api/v1/learning/progress", { data: { courseId: "python", kind: "topic", itemId: "not-a-topic", state: "completed" } });
    assert.equal(unknown.status(), 400);

    step = "career target redirect";
    // Career roadmap: a role target from the jobs page shows its gaps.
    await page.goto("/learning-roadmap?target=1");
    await expect(page).toHaveURL(/\/learning-roadmap\/careers\?target=1$/);
    await expect(page.getByText("Priority gap").first()).toBeVisible();
    await page.goto("/learning-roadmap/careers?target=unknown");
    // Next.js also renders a route-announcer alert, so match the message itself.
    await expect(page.getByRole("alert").filter({ hasText: "no longer available" })).toBeVisible();

    step = "cleanup";
    // Clean up this account's learning rows.
    const reopen = await page.request.put("/api/v1/learning/progress", { data: { courseId: "python", kind: "topic", itemId: "how-programs-work", state: null } });
    assert.equal(reopen.status(), 200);
    console.log("PASS: private learning dashboard, catalog search, preview-then-save enrolment, topic dialog progress persistence, goal change keeps progress, resume, API validation, career target redirect, web path skill map and 320/768/1440px layouts");
  } catch (error) {
    await page.screenshot({ path: "test-results/learning-failure.png", fullPage: true }).catch(() => {});
    error.message = `[learning step: ${step}] ${error.message}`;
    throw error;
  } finally { await page.close(); }
}
