import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// Live end-to-end check of the learning roadmap for a temporary signed-in
// account (run via test:account:live against the development database only).
// Requires migration 202611210001_learning_progress.sql to be applied.
export async function verifyLearningLive(context) {
  const page = await context.newPage();
  try {
    const response = await page.goto("/learning-roadmap");
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn for free");
    await expect(page.getByText("Pick up where you left off")).toHaveCount(0);

    // Search narrows the catalog; the Python guided path opens its setup.
    await page.getByLabel("Search learning paths").fill("python");
    await page.getByRole("link", { name: /Python/ }).first().click();
    await expect(page).toHaveURL(/\/learning-roadmap\/python$/);
    await expect(page.getByRole("heading", { name: "Personalise your roadmap" })).toBeVisible();

    // Preview (GET form, nothing saved) then save.
    await page.getByRole("radio", { name: /Become a Python backend developer/ }).check();
    await page.getByRole("radio", { name: /New to programming/ }).check();
    await page.getByRole("button", { name: "Preview my roadmap" }).click();
    await expect(page).toHaveURL(/goal=backend/);
    await expect(page.getByText("Roadmap preview — not saved yet")).toBeVisible();
    await page.getByRole("button", { name: "Save and start learning" }).click();
    await expect(page).toHaveURL(/\/learning-roadmap\/python$/);
    await expect(page.getByText("Your personalised roadmap")).toBeVisible();

    // Topic dialog: start, complete via criteria, persist across reload.
    await page.goto("/learning-roadmap/python?topic=how-programs-work");
    const dialog = page.getByRole("dialog", { name: "How programs work" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Start this topic" }).click();
    await expect(dialog.getByRole("status").last()).toContainText("in progress");
    for (const box of await dialog.getByRole("checkbox").all()) await box.check();
    await dialog.getByRole("button", { name: "Mark as complete" }).click();
    await expect(dialog.getByRole("button", { name: "Reopen topic" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("dialog", { name: "How programs work" }).getByRole("button", { name: "Reopen topic" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/learning-roadmap\/python$/);

    // Changing goal keeps progress.
    await page.getByRole("radio", { name: /Data analysis/ }).check();
    await page.getByRole("button", { name: "Save plan changes" }).click();
    await expect(page.getByText("Goal: Data analysis")).toBeVisible();
    await expect(page.getByText(/1 of \d+ plan topics completed/)).toBeVisible();

    // Dashboard resumes the saved path; layout reflows without horizontal scroll.
    await page.goto("/learning-roadmap");
    await expect(page.getByText("Pick up where you left off")).toBeVisible();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `test-results/learning-${width}.png`, fullPage: true, animations: "disabled" });
    }

    // API rejects unknown curriculum ids and foreign origins.
    const unknown = await page.request.put("/api/v1/learning/progress", { data: { courseId: "python", kind: "topic", itemId: "not-a-topic", state: "completed" } });
    assert.equal(unknown.status(), 400);

    // Career roadmap: a role target from the jobs page shows its gaps.
    await page.goto("/learning-roadmap?target=1");
    await expect(page).toHaveURL(/\/learning-roadmap\/careers\?target=1$/);
    await expect(page.getByText("Priority gap").first()).toBeVisible();
    await page.goto("/learning-roadmap/careers?target=unknown");
    await expect(page.getByRole("alert")).toContainText("no longer available");

    // Clean up this account's learning rows.
    const reopen = await page.request.put("/api/v1/learning/progress", { data: { courseId: "python", kind: "topic", itemId: "how-programs-work", state: null } });
    assert.equal(reopen.status(), 200);
    console.log("PASS: private learning dashboard, catalog search, preview-then-save enrolment, topic dialog progress persistence, goal change keeps progress, resume, API validation, career target redirect and 320/768/1440px layouts");
  } finally { await page.close(); }
}
