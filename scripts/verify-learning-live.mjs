import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// Live end-to-end check of the learning roadmaps for a temporary signed-in
// account (run via test:account:live against the development database only).
// Requires migration 202611210001_learning_progress.sql to be applied.
export async function verifyLearningLive(context) {
  const page = await context.newPage();
  let step = "open roadmaps";
  const saved = () => page.waitForResponse(response => /\/api\/v1\/learning\/(progress|enrollments|reset)$/.test(response.url()) && response.status() === 200);
  try {
    const response = await page.goto("/learning-roadmap");
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1, name: "Choose your path." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Continue learning" })).toHaveCount(0);

    step = "search and open";
    await page.getByLabel("Search roadmaps").fill("frontend");
    await page.getByRole("link", { name: /^Frontend Developer\s*\d+ topics/ }).click();
    await expect(page).toHaveURL(/\/learning-roadmap\/frontend$/);
    await expect(page.getByRole("heading", { level: 1, name: "Frontend Developer" })).toBeVisible();
    await expect(page.getByText(/^0 of \d+ core topics done$/)).toBeVisible();

    step = "first tick starts the roadmap";
    const http = page.getByRole("button", { name: "Mark HTTP as done" });
    let response1 = saved();
    await http.click();
    await response1;
    await expect(http).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Mark HTTP as done" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/^1 of \d+ core topics done$/)).toBeVisible();

    step = "topic panel, keyboard and deep link";
    await page.getByRole("button", { name: /^HTML\s*\. Core\. Not started/ }).click();
    const panel = page.getByRole("dialog", { name: "HTML" });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\?topic=html$/);
    response1 = saved();
    await page.keyboard.press("l");
    await response1;
    await expect(panel.getByRole("button", { name: "Learning", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("dialog", { name: "HTML" }).getByRole("button", { name: "Learning", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("dialog", { name: "CSS" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/learning-roadmap\/frontend$/);

    step = "failed save rolls back";
    await page.route("**/api/v1/learning/progress", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Saving is unavailable." } }) }));
    const dns = page.getByRole("button", { name: "Mark DNS as done" });
    await dns.click();
    await expect(page.getByText("Saving is unavailable.")).toBeVisible();
    await expect(dns).toHaveAttribute("aria-pressed", "false");
    await page.unroute("**/api/v1/learning/progress");

    step = "shared topic counts elsewhere";
    await page.goto("/learning-roadmap/backend?topic=http");
    await expect(page.getByText("You already finished this in Frontend Developer, so it counts here too.")).toBeVisible();
    await page.keyboard.press("Escape");

    step = "project";
    await page.goto("/learning-roadmap/projects?level=beginner");
    await page.getByRole("link", { name: /Recipe finder/ }).click();
    const project = page.getByRole("dialog", { name: "Recipe finder" });
    await expect(project).toBeVisible();
    await project.getByRole("button", { name: "Start building" }).click();
    await project.getByLabel(/Public code or live demo/).fill("https://github.com/example/recipes");
    await project.getByRole("button", { name: "Mark as built" }).click();
    await expect(project.getByText("Code / demo: https://github.com/example/recipes")).toBeVisible();
    await page.keyboard.press("Escape");

    step = "goal of a guided path";
    await page.goto("/learning-roadmap/python");
    await expect(page.getByRole("heading", { level: 3, name: "Data analysis" })).toHaveCount(0);
    response1 = saved();
    await page.getByRole("button", { name: "Data analysis", exact: true }).click();
    await response1;
    await expect(page.getByRole("heading", { level: 3, name: "Data analysis" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Data analysis", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/learning-roadmap/python?topic=functions");
    await expect(page.getByRole("dialog", { name: "Functions" }).getByRole("heading", { name: "Why it matters" })).toBeVisible();

    step = "resume and layout";
    for (const width of [320, 768, 1440]) {
      // Load at each width (as a phone would) rather than measuring mid-way through
      // the app shell's desktop-to-mobile transition.
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/learning-roadmap", "/learning-roadmap/frontend", "/learning-roadmap/python", "/learning-roadmap/projects", "/learning-roadmap/courses"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow on ${path} at ${width}px`);
      }
      await page.goto("/learning-roadmap");
      await expect(page.getByRole("heading", { name: "Continue learning" })).toBeVisible();
      await page.screenshot({ path: `test-results/learning-${width}.png`, fullPage: true, animations: "disabled" });
    }

    step = "free courses";
    await page.goto("/learning-roadmap/courses");
    await page.getByRole("searchbox", { name: "Search courses" }).fill("machine learning");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=machine\+learning/);
    await expect(page.getByText(/\d+ free courses/)).toBeVisible();
    assert.ok(await page.locator('a[target="_blank"][rel="noopener noreferrer"]').count() > 10);

    step = "API validation";
    const unknown = await page.request.put("/api/v1/learning/progress", { data: { courseId: "python", kind: "topic", itemId: "not-a-topic", state: "completed" } });
    assert.equal(unknown.status(), 400);
    const foreignReset = await page.request.post("/api/v1/learning/reset", { data: { courseId: "frontend", confirm: true }, headers: { origin: "https://evil.example" } });
    assert.equal(foreignReset.status(), 403);

    step = "career target redirect";
    // Career roadmap: a role target from the jobs page shows its gaps.
    await page.goto("/learning-roadmap?target=1");
    await expect(page).toHaveURL(/\/learning-roadmap\/careers\?target=1$/);
    await expect(page.getByText("Priority gap").first()).toBeVisible();
    await page.goto("/learning-roadmap/careers?target=unknown");
    // Next.js also renders a route-announcer alert, so match the message itself.
    await expect(page.getByRole("alert").filter({ hasText: "no longer available" })).toBeVisible();

    step = "clear progress";
    for (const path of ["/learning-roadmap/frontend", "/learning-roadmap/python"]) {
      await page.goto(path);
      await page.getByRole("button", { name: "Clear my progress on this roadmap" }).click();
      response1 = saved();
      await page.getByRole("button", { name: "Yes, clear it" }).click();
      await response1;
      await page.reload();
      await expect(page.getByText(/^0 of \d+ core topics done$/)).toBeVisible();
    }
    await page.goto("/learning-roadmap");
    await expect(page.getByRole("heading", { name: "Continue learning" })).toHaveCount(0);
    console.log("PASS: private roadmaps, search, first tick starts a roadmap, topic panel with keyboard and deep links, rollback on failed save, shared topic credit, project evidence, guided goals, resume, 320/768/1440px layout, free course search, API validation, career target redirect, clear progress.");
  } catch (error) {
    await page.screenshot({ path: "test-results/learning-failure.png", fullPage: true }).catch(() => {});
    error.message = `[learning step: ${step}] ${error.message}`;
    throw error;
  } finally { await page.close(); }
}
