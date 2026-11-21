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

    step = "interactive roadmap graph";
    // The graph is the default view: completed state, next step, zoom, pan, search, focus mode and list view.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/learning-roadmap/python");
    const graph = page.getByLabel(/^Interactive roadmap/);
    await expect(graph).toBeVisible();
    await expect(graph.locator(".react-flow__node-topic")).toHaveCount(61);
    await expect(graph.getByRole("link", { name: /^How programs work\. Completed/ })).toHaveCount(1);
    await expect(graph.locator("[data-next]")).toHaveCount(1);
    await expect(graph.locator("[data-next] a")).not.toHaveAttribute("aria-label", /^How programs work/);
    const viewport = () => graph.locator(".react-flow__viewport").getAttribute("style");
    let before = await viewport();
    await graph.locator(".react-flow__controls-zoomin").click();
    await expect.poll(viewport).not.toBe(before);
    before = await viewport();
    // Drag from an empty spot of the pane (not a node, control or minimap).
    const start = await graph.evaluate(element => {
      const rect = element.getBoundingClientRect();
      for (let y = rect.top + 40; y < rect.bottom - 40; y += 24) {
        for (let x = rect.left + 80; x < rect.right - 260; x += 24) {
          if (document.elementFromPoint(x, y)?.classList.contains("react-flow__pane")) return { x, y };
        }
      }
      return null;
    });
    assert.ok(start, "the graph has empty pane to drag");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 120, start.y - 160, { steps: 8 });
    await page.mouse.up();
    await expect.poll(viewport).not.toBe(before);
    before = await viewport();
    const search = page.getByRole("combobox", { name: "Search topics" });
    await search.fill("asyncio");
    await expect(page.getByRole("option", { name: /Asynchronous programming with asyncio/ })).toBeVisible();
    await search.press("Enter");
    await expect.poll(viewport).not.toBe(before);
    await expect(page.getByText(/Asynchronous programming with asyncio: \d+ prerequisites/)).toBeVisible();
    const allNodes = await graph.locator(".react-flow__node").count();
    await page.getByRole("button", { name: "Focus mode" }).click();
    await expect.poll(() => graph.locator(".react-flow__node").count()).toBeLessThan(allNodes);
    await page.getByRole("button", { name: "Focus mode" }).click();
    await expect(graph.locator(".react-flow__node")).toHaveCount(allNodes);
    await page.getByRole("button", { name: "Jump to next topic" }).click();
    await page.getByRole("link", { name: "List", exact: true }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(graph).toHaveCount(0);
    await page.goto("/learning-roadmap/python");

    step = "change goal keeps progress";
    // Changing goal keeps progress.
    await page.getByRole("radio", { name: /Data analysis/ }).check();
    await page.getByRole("button", { name: "Save plan changes" }).click();
    await expect(page.getByText("Goal: Data analysis")).toBeVisible();
    await expect(page.getByText(/1 of \d+ plan topics completed/)).toBeVisible();

    step = "reset progress";
    // Two-step reset clears topic progress but keeps the goal; it persists across reload.
    await page.getByRole("button", { name: "Reset progress" }).click();
    await page.getByRole("button", { name: "Yes, reset my progress" }).click();
    await expect(page.getByText("Progress reset.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(/^0 of \d+ plan topics completed/)).toBeVisible();
    await expect(page.getByText("Goal: Data analysis")).toBeVisible();
    const foreignReset = await page.request.post("/api/v1/learning/reset", { data: { courseId: "python", confirm: true }, headers: { origin: "https://evil.example" } });
    assert.equal(foreignReset.status(), 403);

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

    step = "web path graph";
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/learning-roadmap");
    await expect(page.getByRole("link", { name: /JavaScript & Web Development/ })).toBeVisible();
    await page.goto("/learning-roadmap/web-development?goal=full-stack&level=new&hours=8&format=mixed");
    const map = page.getByLabel(/^Interactive roadmap/);
    await expect(map).toBeVisible();
    await expect.poll(() => map.locator(".react-flow__node-topic a").count(), { message: "every topic appears on the graph" }).toBeGreaterThanOrEqual(40);
    const nextLink = map.locator("[data-next] a");
    await expect(nextLink).toHaveCount(1);
    await expect(nextLink).toHaveAttribute("aria-label", /^How the web works\. Ready to start\. Your next topic/);
    await nextLink.click();
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
    console.log("PASS: private learning dashboard, catalog search, preview-then-save enrolment, topic dialog progress persistence, goal change keeps progress, resume, API validation, career target redirect, reset progress, interactive graph (zoom, pan, search, focus mode, list view), web path graph and 320/768/1440px layouts");
  } catch (error) {
    await page.screenshot({ path: "test-results/learning-failure.png", fullPage: true }).catch(() => {});
    error.message = `[learning step: ${step}] ${error.message}`;
    throw error;
  } finally { await page.close(); }
}
