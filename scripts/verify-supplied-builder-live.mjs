import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { expect } from "@playwright/test";

// Exercise the supplied builder inside CareerForge without promoting its local
// sample edits into saved profile facts or approved public snapshots.
export async function verifySuppliedBuilderLive(context) {
  const profileResponse = await context.request.get("/api/v1/profile");
  assert.equal(profileResponse.status(), 200);
  const savedProfile = await profileResponse.json();
  const page = await context.newPage();
  const errors = [];
  const accountWrites = [];
  const builder = page.locator(".pb");
  const desktopNavigation = page.locator(".app-sidebar nav");
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (["/api/v1/profile", "/api/v1/portfolio"].includes(path) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      accountWrites.push(`${request.method()} ${path}`);
    }
  });
  async function readWorkspaceChrome() {
    return page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const swatch = document.createElement("span");
      swatch.hidden = true;
      document.body.append(swatch);
      const color = token => {
        swatch.style.color = root.getPropertyValue(token);
        return getComputedStyle(swatch).color;
      };
      const palette = ["--paper", "--surface", "--raised"].map(color);
      const accent = color("--green");
      swatch.remove();
      const background = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
      return {
        palette, accent,
        panels: [".pb .panel", ".pb .toolbar", ".pb .hint", ".supplied-builder-bar"].map(background),
        selectedTab: background(".pb .toolbar > .seg .on"),
        generateButton: background(".pb .panel .btn.primary"),
        generateImage: getComputedStyle(document.querySelector(".pb .panel .btn.primary")).backgroundImage
      };
    });
  }
  async function expectCenteredPortfolio(width) {
    const geometry = await builder.locator(".preview").evaluate(preview => {
      const canvas = preview.querySelector(".port").getBoundingClientRect();
      const frame = preview.getBoundingClientRect();
      return {
        available: preview.clientWidth,
        width: canvas.width,
        center: canvas.left + canvas.width / 2,
        frameCenter: frame.left + preview.clientLeft + preview.clientWidth / 2
      };
    });
    assert.ok(Math.abs(geometry.center - geometry.frameCenter) <= 2, `Portfolio must be centered at ${width}px`);
    assert.ok(geometry.width <= geometry.available + 1 && geometry.width <= 1121, `Portfolio must fit its frame and stay readable at ${width}px`);
    assert.ok(geometry.width >= Math.min(640, Math.max(0, geometry.available - 48)), `Portfolio must use the available space at ${width}px`);
  }
  async function expectSharedPageScroll() {
    const scrollRegions = await builder.locator(".preview, .panel").evaluateAll(elements => elements.map(element => ({
      name: element.className,
      overflow: getComputedStyle(element).overflowY,
      scrollTop: element.scrollTop
    })));
    for (const region of scrollRegions) {
      assert.ok(["visible", "clip"].includes(region.overflow), `The ${region.name} region must use page scrolling`);
      assert.equal(region.scrollTop, 0);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 300), true);
    for (const target of [builder.locator(".panel h1"), builder.locator(".hero h2")]) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await target.scrollIntoViewIfNeeded();
      const bounds = await target.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      const before = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 450);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
      assert.equal(await builder.locator(".preview").evaluate(element => element.scrollTop), 0);
      assert.equal(await builder.locator(".panel").evaluate(element => element.scrollTop), 0);
      const header = await page.locator(".app-topbar").boundingBox();
      const toolbar = await builder.locator(".toolbar").boundingBox();
      if (toolbar.y + toolbar.height > header.y && toolbar.y < 1000) {
        assert.ok(toolbar.y >= header.y + header.height - 1, "The builder toolbar must stay below the application header");
      }
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
  async function expectSectionAnchorClearance(width) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const skills = builder.locator('[data-sec="skills"]');
    const navigation = builder.getByRole("navigation", { name: "Sections", exact: true });
    const skillsLink = navigation.getByRole("button", { name: "Skills", exact: true });
    await skillsLink.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await skillsLink.click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
    // Wait for the real smooth-scroll target, not an intermediate animation frame.
    await expect.poll(() => skills.evaluate(element => Math.abs(
      element.getBoundingClientRect().top - parseFloat(getComputedStyle(element).scrollMarginTop)
    ))).toBeLessThan(3);
    const heading = await skills.getByRole("heading", { name: "What I work with", exact: true }).boundingBox();
    const sectionNavigation = await navigation.boundingBox();
    const applicationHeader = await page.locator(".app-topbar").boundingBox();
    assert.ok(heading.y >= sectionNavigation.y + sectionNavigation.height + 8, `Section heading must clear the sticky portfolio navigation at ${width}px`);
    assert.ok(heading.y >= applicationHeader.y + applicationHeader.height + 8, `Section heading must clear the application header at ${width}px`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  }
  async function expectUnifiedNavigation(navigation) {
    const documents = navigation.getByRole("link", { name: "CV & Portfolio", exact: true });
    await expect(documents).toHaveCount(1);
    await expect(documents).toHaveAttribute("href", "/documents");
    await expect(documents).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByRole("link", { name: "My CV", exact: true })).toHaveCount(0);
    await expect(navigation.getByRole("link", { name: "My portfolio", exact: true })).toHaveCount(0);
  }
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto("/documents");
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectUnifiedNavigation(desktopNavigation);
    await expect(page.locator("main")).toHaveCount(1);
    // Builder drafts now autosave to the owner's account (portfolio_sites), never to the profile.
    await expect(page.locator(".supplied-builder-bar")).toContainText("Your CV & portfolio");
    await expect(page.locator(".builder-save-state")).toHaveText("Autosave on");
    await expect(builder.getByRole("heading", { name: "Turn rough notes into a portfolio and CV", exact: true })).toBeVisible();
    await expect(builder.getByRole("tab", { name: "Web portfolio", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(builder.locator(".hero h2")).toHaveText("Sara Khoury");
    const avatar = await builder.locator(".avatar").boundingBox();
    assert.ok(avatar.width > 150 && Math.abs(avatar.height / avatar.width - 1.25) < 0.02, "Portfolio photo frame must retain the supplied 4:5 layout");
    await expect(builder.locator(".socials a")).toHaveCount(5);
    await expect(builder.locator('.socials a[aria-label="Email"]')).toHaveAttribute("href", "mailto:sara.khoury@email.com");
    await expect(page.getByRole("link", { name: "Saved-profile CV", exact: true })).toHaveAttribute("href", "/cv/saved");
    await expect(page.getByRole("link", { name: "Profile portfolio", exact: true })).toHaveAttribute("href", "/portfolio/publication");

    const initialChrome = await readWorkspaceChrome();
    assert.ok(initialChrome.panels.every(color => initialChrome.palette.includes(color)), "Builder chrome must use the website surface colors");
    assert.equal(initialChrome.selectedTab, initialChrome.accent, "The view selector must use the website accent");
    assert.equal(initialChrome.generateButton, initialChrome.accent, "The Generate action must use the website accent");
    assert.equal(initialChrome.generateImage, "none", "Preview gradients must not theme the workspace action");
    await expectCenteredPortfolio(1440);
    const notes = builder.getByLabel("Your notes", { exact: true });
    const originalNotes = await notes.inputValue();
    const draftNotes = "These draft notes must survive hiding and reopening the notes panel.";
    await notes.fill(draftNotes);
    await builder.locator(".hero h2").fill("Collapse State Person");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const expandedStage = await builder.locator(".stage").boundingBox();
    const hideNotes = page.getByRole("button", { name: "Hide notes", exact: true });
    await expect(hideNotes).toHaveAttribute("aria-expanded", "true");
    await expect(hideNotes).toHaveAttribute("aria-controls", "builder-notes-panel");
    const notesPanel = builder.locator("#builder-notes-panel");
    const gridTransition = await builder.evaluate(element => getComputedStyle(element).transitionDuration);
    assert.notEqual(gridTransition, "0s", "Notes layout should animate when reduced motion is not requested");
    await hideNotes.click();
    const showNotes = page.getByRole("button", { name: "Show notes", exact: true });
    await expect(showNotes).toHaveAttribute("aria-expanded", "false");
    await expect(notesPanel).toHaveAttribute("aria-hidden", "true");
    await expect(notesPanel).toHaveAttribute("inert", "");
    await expect(notesPanel).not.toBeVisible();
    await expect(notes).not.toBeVisible();
    assert.equal(await notes.evaluate(element => { element.focus(); return document.activeElement === element; }), false, "Hidden notes must not receive keyboard focus");
    await expect.poll(async () => (await builder.locator(".stage").boundingBox())?.width ?? 0).toBeGreaterThan(expandedStage.width + 200);
    await expectCenteredPortfolio(1440);
    await page.screenshot({ path: "test-results/supplied-builder-collapsed-1440.png", fullPage: true, animations: "disabled" });
    await showNotes.press("Enter");
    await expect(hideNotes).toHaveAttribute("aria-expanded", "true");
    await expect(notesPanel).not.toHaveAttribute("inert", "");
    await expect(notes).toHaveValue(draftNotes);
    await expect(builder.locator(".hero h2")).toHaveText("Collapse State Person");
    await hideNotes.press("Space");
    await expect(showNotes).toHaveAttribute("aria-expanded", "false");
    await showNotes.press("Space");
    await expect(notes).toHaveValue(draftNotes);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await hideNotes.click();
    await expect(builder).toHaveCSS("transition-duration", "0s");
    await expect(notesPanel).not.toBeVisible();
    await page.getByRole("button", { name: "Show notes", exact: true }).click();
    await expect(notesPanel).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await notes.fill(originalNotes);
    await builder.locator(".hero h2").fill("Sara Khoury");
    await hideNotes.focus();
    await expectSharedPageScroll();

    await builder.getByRole("button", { name: "emerald", exact: true }).click();
    await expect(builder.getByRole("button", { name: "emerald", exact: true })).toHaveAttribute("aria-pressed", "true");
    assert.equal(await builder.evaluate(element => element.style.getPropertyValue("--a")), "#3ddc97");
    await builder.getByLabel("Custom color", { exact: true }).fill("#e06b50");
    assert.equal(await builder.evaluate(element => element.style.getPropertyValue("--a")), "#e06b50");
    await builder.getByRole("button", { name: "Switch to light mode", exact: true }).click();
    await expect(builder).toHaveAttribute("data-mode", "light");
    assert.deepEqual(await readWorkspaceChrome(), initialChrome, "Changing the preview theme must not recolor CareerForge controls");
    await builder.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
    await expect(builder).toHaveAttribute("data-mode", "dark");

    await builder.locator(".hero h2").fill("Local Draft Person");
    await builder.getByRole("button", { name: "+ Add skill", exact: true }).click();
    const newSkill = builder.locator(".chip").filter({ hasText: "New skill" });
    await newSkill.scrollIntoViewIfNeeded();
    await expect.poll(() => newSkill.evaluate(element => getComputedStyle(element).opacity)).toBe("1");
    await newSkill.getByRole("button", { name: "Remove New skill", exact: true }).click();
    await expect(newSkill).toHaveCount(0);
    await builder.locator('[data-sec="contact"]').scrollIntoViewIfNeeded();
    await expect(builder.getByRole("button", { name: "Back to top", exact: true })).toHaveClass(/show/);
    await expect.poll(() => builder.locator(".prog").evaluate(element => element.style.transform)).not.toBe("scaleX(0)");
    await builder.getByRole("button", { name: "Back to top", exact: true }).click();

    // Exercise the hero CTA without opening an interactive browser print dialog.
    await page.evaluate(() => { window.__builderPrintCalls = 0; window.print = () => { window.__builderPrintCalls++; }; });
    await builder.getByRole("button", { name: "Download CV", exact: true }).click();
    await expect(builder.getByRole("tab", { name: "CV", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => page.evaluate(() => window.__builderPrintCalls)).toBe(1);
    // "Professional bullet" is the default CV style since 4aa7fae; Modern is opt-in.
    await expect(builder.getByRole("tab", { name: "Professional bullet", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(builder.locator(".cv.bullet h1")).toHaveText("Local Draft Person");
    await builder.getByRole("tab", { name: "Modern", exact: true }).click();
    await expect(builder.locator(".cv.modern h1")).toHaveText("Local Draft Person");
    await expect(builder.getByRole("checkbox", { name: "Photo on CV", exact: true })).toBeDisabled();
    await builder.getByRole("button", { name: "Download PDF", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__builderPrintCalls), 2);

    await builder.getByRole("tab", { name: "Email", exact: true }).click();
    const contact = builder.locator(".cdetail .ed");
    await expect(contact).toHaveText("sara.khoury@email.com");
    await contact.fill("local-draft@careerforge.invalid");
    await builder.getByRole("button", { name: "+ Add education", exact: true }).click();
    const education = builder.locator(".edu");
    await expect(education).toHaveCount(1);
    await education.locator(".cv-row strong .ed").fill("Local Test University");
    await education.locator(".edu-d .ed").fill("Local Degree Draft");
    await education.locator(".per .ed").fill("2024-2026");
    await builder.getByRole("button", { name: "+ Add language", exact: true }).click();
    const languages = builder.locator(".cv-side .mx-skills").nth(1);
    await languages.locator(".ed").fill("Arabic - working proficiency");
    await builder.getByRole("button", { name: "+ Add language", exact: true }).click();
    await languages.locator(".ed").last().fill("French draft");
    await builder.locator(".cv h1").click();
    // The remove button shows on hover or keyboard focus. Use the keyboard: the builder's sticky bar
    // can sit on top of a chip near the edge, which makes hovering unreliable.
    await languages.getByRole("button", { name: "Remove French draft", exact: true }).press("Enter");
    await expect(languages.locator(".mx-skill")).toHaveCount(1);
    await builder.getByRole("tab", { name: "ATS-safe", exact: true }).click();
    await expect(builder.locator(".cv.ats h1")).toHaveText("Local Draft Person");
    for (const text of ["Local Test University", "Local Degree Draft", "Arabic - working proficiency", "local-draft@careerforge.invalid"]) {
      await expect(builder.locator(".cv.ats")).toContainText(text);
    }
    await builder.getByRole("tab", { name: "Modern", exact: true }).click();
    await education.hover();
    await education.getByRole("button", { name: "Remove education", exact: true }).click();
    await expect(education).toHaveCount(0);
    await builder.getByRole("button", { name: "+ Add education", exact: true }).click();
    await education.locator(".cv-row strong .ed").fill("Local Test University");
    await education.locator(".edu-d .ed").fill("Local Degree Draft");
    await builder.locator(".cv h1").click();

    await builder.getByRole("tab", { name: "Web portfolio", exact: true }).click();
    await expect(builder.locator('[data-sec="education"]')).toContainText("Local Test University");
    await builder.locator('input[type="file"]').setInputFiles({
      name: "local-test-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6txsAAAAASUVORK5CYII=", "base64")
    });
    await expect(builder.locator(".avatar img")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await builder.getByRole("tab", { name: "CV", exact: true }).click();
    await expect(builder.getByRole("checkbox", { name: "Photo on CV", exact: true })).toBeEnabled();
    await expect(builder.locator(".mx-photo")).toBeVisible();
    await builder.getByRole("checkbox", { name: "Photo on CV", exact: true }).uncheck();
    await expect(builder.locator(".mx-photo")).toHaveCount(0);

    for (const width of [320, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      // Let the app shell finish its desktop/mobile transition; genuine overflow still fails.
      const fits = await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 3000 }).then(() => true, () => false);
      assert.equal(fits, true, `CV overflow at ${width}px`);
      if (width === 320) {
        const hideNotes = page.getByRole("button", { name: "Hide notes", exact: true });
        await hideNotes.click();
        const showNotes = page.getByRole("button", { name: "Show notes", exact: true });
        await expect(showNotes).toHaveAttribute("aria-expanded", "false");
        await expect(builder.locator(".panel")).not.toBeVisible();
        await expect(builder.locator(".cv h1")).toHaveText("Local Draft Person");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Collapsed notes must fit a narrow screen");
        await page.screenshot({ path: "test-results/supplied-builder-collapsed-320.png", fullPage: true, animations: "disabled" });
        await showNotes.press("Enter");
        await expect(builder.getByLabel("Your notes", { exact: true })).toHaveValue(originalNotes);
      }
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      if (await menu.isVisible()) {
        await menu.click();
        const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
        await expectUnifiedNavigation(drawer);
        await drawer.getByRole("link", { name: "CV & Portfolio", exact: true }).click();
        await expect(drawer).not.toBeVisible();
        await expect(page).toHaveURL(/\/documents$/);
      }
      await page.screenshot({ path: `test-results/supplied-builder-cv-${width}.png`, fullPage: true, animations: "disabled" });
      await builder.getByRole("tab", { name: "Web portfolio", exact: true }).click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Portfolio overflow at ${width}px`);
      await expectCenteredPortfolio(width);
      if (width === 320 || width === 1440) await expectSectionAnchorClearance(width);
      await page.screenshot({ path: `test-results/supplied-builder-portfolio-${width}.png`, fullPage: true, animations: "disabled" });
      await builder.getByRole("tab", { name: "CV", exact: true }).click();
    }

    await page.emulateMedia({ media: "print" });
    for (const selector of [".pb .toolbar", ".supplied-builder-bar", ".app-sidebar", ".app-topbar"]) {
      await expect(page.locator(selector)).not.toBeVisible();
    }
    // The shell animates its margin, so poll for the settled print layout.
    await expect.poll(() => page.locator(".app-main").evaluate(element => getComputedStyle(element).marginLeft)).toBe("0px");
    await expect.poll(() => page.locator(".app-content").evaluate(element => getComputedStyle(element).padding)).toBe("0px");
    await expect(builder.locator(".cv.modern")).toBeVisible();
    await expect(builder.locator(".cprint")).toBeVisible();
    await expect(builder.locator(".cprint")).toContainText("local-draft@careerforge.invalid");
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 1000);
    await writeFile("test-results/supplied-builder-cv.pdf", pdf);
    await page.emulateMedia({ media: "screen" });

    await builder.getByLabel("Your notes", { exact: true }).fill("i'm demo applicant, frontend developer.");
    // This step checks the demo fallback when no AI is connected. Development may have the test AI or a
    // real key, so the "not connected" answer is simulated for this one request (and nothing is spent).
    await page.route("**/api/generate", route => route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_IMPLEMENTED", message: "AI generation is not connected. The builder can show fictional sample content in demo mode." } }) }));
    const generation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/generate" && response.request().method() === "POST");
    await builder.getByRole("button", { name: "Generate with AI", exact: true }).click();
    assert.equal((await generation).status(), 501);
    await page.unroute("**/api/generate");
    await expect(builder.locator(".note[role=status]")).toContainText("Demo mode");
    await expect(builder.locator(".cv h1")).toHaveText("Demo Applicant");
    assert.deepEqual(await (await context.request.get("/api/v1/profile")).json(), savedProfile);
    assert.deepEqual(accountWrites, []);
    await expect(page.locator(".builder-save-state")).toContainText("Saved", { timeout: 15000 });
    const savedSite = await (await context.request.get("/api/v1/portfolio-site")).json();
    assert.equal(savedSite.draft.data.name, "Demo Applicant", "the builder draft is saved to the account");
    assert.equal(savedSite.isPublic, false, "saving never publishes");

    for (const path of ["/cv", "/portfolio"]) {
      const legacy = await page.goto(path);
      assert.equal(legacy.status(), 200);
      assert.ok(legacy.headers()["cache-control"].includes("no-store"));
      await expect(page).toHaveURL(/\/documents$/);
      await expectUnifiedNavigation(desktopNavigation);
      await expect(builder.locator(".hero h2")).toHaveText("Demo Applicant");
    }
    for (const path of ["/cv/saved", "/portfolio/publication"]) {
      await page.goto(path);
      await expectUnifiedNavigation(desktopNavigation);
      await desktopNavigation.getByRole("link", { name: "CV & Portfolio", exact: true }).click();
      await expect(page).toHaveURL(/\/documents$/);
      await expect(builder.locator(".hero h2")).toHaveText("Demo Applicant");
    }
    await builder.getByRole("tab", { name: "CV", exact: true }).click();
    // The saved CV style (Modern, chosen earlier) is restored with the draft.
    await expect(builder.locator(".cv.modern h1")).toHaveText("Demo Applicant");
    await page.reload();
    await expect(builder.locator(".hero h2")).toHaveText("Demo Applicant");
    await verifyWebsitePublishing(page, context);
    assert.deepEqual(errors, []);
    console.log("PASS: unified CV & Portfolio navigation/aliases; supplied education/language/contact/photo editing, visible skill insertion, styles, print CTA/PDF, source isolation, 320/768/1440/1920 centered preview, collapsible preserved notes, shared page scroll, unobscured section links, website-colored chrome, demo generation, autosaved drafts and website publish/update/offline");
  } catch (error) {
    console.error("Supplied builder verification:", error.message);
    await page.screenshot({ path: "test-results/supplied-builder-failure.png", fullPage: true }).catch(() => {});
    throw error;
  } finally { await page.close(); }
}
// Publish the saved builder portfolio, visit it anonymously, then take it offline.
async function verifyWebsitePublishing(page, context) {
  const slug = `live-test-${Math.random().toString(36).slice(2, 10)}`;
  await page.getByRole("button", { name: "Publish website", exact: true }).click();
  const panel = page.getByRole("region", { name: "Publish your portfolio website" });
  await panel.getByLabel("Web address").fill(slug);
  await panel.getByRole("button", { name: "Publish website", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "Your portfolio is live" })).toBeVisible();
  const liveLink = panel.locator(".builder-live a");
  await expect(liveLink).toHaveAttribute("href", new RegExp(`/u/${slug}$`));
  const visitor = await context.browser().newContext({ baseURL: new URL(page.url()).origin });
  try {
    const publicPage = await visitor.newPage();
    const response = await publicPage.goto(`/u/${slug}`);
    assert.equal(response.status(), 200);
    assert.ok(response.headers()["cache-control"].includes("no-store"));
    await expect(publicPage.locator(".hero h2")).toHaveText("Demo Applicant");
    await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(publicPage.locator("[contenteditable]")).toHaveCount(0);
    await expect(publicPage.getByRole("button", { name: "+ Add skill" })).toHaveCount(0);
    await expect(publicPage.getByText("i'm demo applicant")).toHaveCount(0);
    for (const width of [320, 1440]) {
      await publicPage.setViewportSize({ width, height: 900 });
      await publicPage.reload();
      await expect(publicPage.locator(".hero h2")).toHaveText("Demo Applicant");
      await publicPage.waitForTimeout(600); // let entrance animations settle before the screenshot
      assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `public site overflow at ${width}px`);
      await publicPage.screenshot({ path: `test-results/published-site-${width}.png`, fullPage: false });
    }
    assert.equal((await visitor.request.get("/u/no-such-site-here")).status(), 404);
    await panel.getByRole("button", { name: "Take offline", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "Publish your portfolio as a website" })).toBeVisible();
    assert.equal((await visitor.request.get(`/u/${slug}`)).status(), 404, "offline sites disappear immediately");
  } finally { await visitor.close(); }
}
