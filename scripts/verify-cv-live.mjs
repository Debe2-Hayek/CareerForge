import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

export async function verifyCVLive(context) {
  const response = await context.request.get("/api/v1/profile");
  assert.equal(response.status(), 200);
  const { profile } = await response.json();
  const page = await context.newPage();
  try {
    const navigation = await page.goto("/cv/saved");
    assert.ok(navigation.headers()["cache-control"].includes("no-store"));
    await expect(page.getByRole("article", { name: "CV preview" }).getByRole("heading", { level: 2 })).toHaveText(profile.name);
    await expect(page.locator(".cv-skills li")).toHaveCount(0);
    await page.goto("/skill-checks");
    // Skill checks are part of verification: no clock, one question at a time, a new order per attempt.
    const card = page.locator(".check-card").filter({ has: page.getByRole("heading", { name: "React", exact: true }) });
    await expect(card.locator(".check-state")).toHaveText("On your profile");
    const right = { r1: "setCount(previous => previous + 1)", r2: "A stable unique record ID", r3: "Return a cleanup function from the effect", r4: "Create a new array with the changed record", r5: "Derive it from the props without duplicate state" };
    const firstStart = page.waitForResponse(response => response.url().endsWith("/api/v1/skill-checks/sessions") && response.request().method() === "POST");
    await card.getByRole("button", { name: "Start check", exact: true }).click();
    const firstStartResponse = await firstStart;
    const firstStartBody = await firstStartResponse.json();
    assert.equal(firstStartResponse.status(), 200, firstStartBody.error?.message);
    const firstSession = firstStartBody.session;
    assert.equal(firstSession.timingMode, "untimed");
    assert.equal(Date.parse(firstSession.deadlineAt) - Date.parse(firstSession.startedAt), 86400000, "an open attempt lapses after 24 hours, with no visible clock");
    assert.equal(firstSession.questions.length, 5);
    assert.equal(JSON.stringify(firstSession).includes('"answer"'), false, "no answer key reaches the browser");
    await expect(page.getByRole("timer")).toHaveCount(0);
    const answer = async () => {
      const prompt = await page.locator(".check-question legend h2").innerText();
      const question = firstSession.questions.find(item => item.prompt === prompt);
      await page.locator(".check-option", { hasText: right[question.id] }).click();
    };
    await expect(page.locator(".check-step")).toContainText("Question 1 of 5");
    await answer();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".check-step")).toContainText("Question 2 of 5");
    // Leave and come back: the same attempt, and the answer given so far is still there.
    await page.getByRole("button", { name: "Save and leave", exact: true }).click();
    await expect(card.getByRole("button", { name: "Continue", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator(".check-step")).toContainText("Question 2 of 5");
    await page.locator(".check-progress button").first().click();
    await expect(page.locator(".check-option[data-picked]")).toHaveCount(1);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    for (let n = 2; n <= 5; n++) {
      await answer();
      await page.getByRole("button", { name: n < 5 ? "Next" : "Review answers", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Check your answers" })).toBeFocused();
    await expect(page.locator(".check-summary li")).toHaveCount(5);
    const submission = "**/api/v1/skill-checks";
    await page.route(submission, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Temporary assessment outage" } }) }));
    await page.getByRole("button", { name: "Send answers", exact: true }).click();
    await expect(page.locator(".form-error[role=alert]")).toContainText("Temporary assessment outage");
    await expect(page.getByRole("button", { name: "Send answers", exact: true })).toBeEnabled();
    await page.unroute(submission);
    await page.route(submission, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { skill: "React", score: 5, passed: true } }) }));
    await page.getByRole("button", { name: "Send answers", exact: true }).click();
    await expect(page.locator(".form-error[role=alert]")).toContainText("could not be confirmed");
    await page.unroute(submission);
    await page.getByRole("button", { name: "Send answers", exact: true }).click();
    await expect(page.getByRole("heading", { name: "React is now Verified" })).toBeVisible();
    await expect(page.locator(".check-score")).toContainText("5 of 5");
    await expect(page.getByRole("link", { name: /See it on your CV/ })).toHaveAttribute("href", "/cv/saved");
    const repeated = await context.request.post("/api/v1/skill-checks", { data: { sessionId: firstSession.id, answers: { r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 } } });
    assert.equal(repeated.status(), 200);
    assert.equal((await repeated.json()).result.score, 5, "a repeated submit returns the recorded result, never a second grade");
    const limited = await context.request.post("/api/v1/skill-checks/sessions", { data: { action: "start", skill: "SQL" } });
    assert.equal(limited.status(), 429);
    assert.ok(Number(limited.headers()["retry-after"]) > 0);
    for (const old of [{ action: "start", skill: "SQL", version: 1 }, { action: "start", skill: "SQL", timingMode: "extended" }]) {
      assert.equal((await context.request.post("/api/v1/skill-checks/sessions", { data: old })).status(), 400, "no clock or version can be chosen");
    }
    const forged = await context.request.post("/api/v1/skill-checks", { data: { sessionId: firstSession.id, answers: { r1: 1, r2: 2, r3: 1, r4: 2, r5: 0 }, passed: true } });
    assert.equal(forged.status(), 400);
    assert.equal((await context.request.post("/api/v1/skill-checks", { headers: { Origin: "https://untrusted.example" }, data: {} })).status(), 403);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(card.locator(".check-state")).toContainText("Verified");
    // UI-only fixture for the 24-hour wait (the real rule is checked in the rolled-back database run).
    const retryAt = new Date(Date.now() + 20 * 3600000).toISOString();
    await page.route("**/api/v1/skill-checks/sessions", route => route.fulfill({ status: 429, json: { error: { code: "TRY_LATER", message: "You can take this check again 24 hours after a failed attempt.", retryAt } } }));
    await card.getByRole("button", { name: "Take again", exact: true }).click();
    await expect(page.locator(".check-intro .form-error")).toContainText("24 hours");
    await expect(page.getByRole("button", { name: "Start the check" })).toBeDisabled();
    await page.getByRole("button", { name: "Not now", exact: true }).click();
    await page.unroute("**/api/v1/skill-checks/sessions");
    await page.goto("/cv/saved");
    await expect(page.locator(".cv-skills li")).toHaveCount(1);
    await expect(page.locator(".cv-skills li")).toHaveText("React");
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "CV & Portfolio", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("button", { name: "Print / save as PDF" })).toBeEnabled();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      // Let the app shell finish its desktop/mobile transition; genuine overflow still fails.
      const fits = await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 3000 }).then(() => true, () => false);
      assert.equal(fits, true, `CV horizontal overflow at ${width}px`);
      await page.screenshot({ path: `test-results/cv-${width}.png`, fullPage: true, animations: "disabled" });
    }
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".cv-tools")).not.toBeVisible();
    await expect(page.locator(".cv-sheet")).toBeVisible();
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 1000);
    await writeFile("test-results/cv-preview.pdf", pdf);
    console.log("PASS: untimed shuffled check: start, leave and resume, reload with saved answers, review, idempotent grading, error recovery, 24-hour wait message, forged/old-timing/rate-limit denial; CV eligibility/reflow/PDF");
  } finally { await page.close(); }
}
