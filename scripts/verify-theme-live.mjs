import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expect } from "@playwright/test";

// Visits every page in both themes for a temporary signed-in account (development
// only, via test:account:live) and measures the contrast of the visible text.
// THEME_SCREENSHOTS=folder also saves a picture of each page.

const publicPages = ["/", "/login", "/register", "/forgot-password", "/no-such-page"];
const privatePages = ["/account", "/account/history", "/dashboard", "/features", "/career-analysis", "/skill-checks", "/academic-planner", "/learning-roadmap", "/learning-roadmap/docker", "/learning-roadmap/frontend", "/learning-roadmap/courses", "/learning-roadmap/projects", "/learning-roadmap/careers", "/learning-roadmap/product",
  "/workshops", "/workshops?topic=python", "/workshops?workshop=docker-get-started", "/documents", "/cv", "/cv/saved", "/portfolio", "/portfolio/publication", "/jobs", "/applications", "/application-agent", "/application-insights", "/career-assistant", "/graduation-simulator", "/cv-analysis"];

/** Text whose contrast can be measured: an opaque or layered plain background, no picture or gradient behind it. */
function audit() {
  const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  canvas.canvas.width = canvas.canvas.height = 1;
  const known = new Map();
  const rgba = value => {
    if (!known.has(value)) {
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = "#000";
      canvas.fillStyle = value;
      canvas.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
      known.set(value, [r, g, b, a / 255]);
    }
    return known.get(value);
  };
  const over = (top, under) => top.slice(0, 3).map((v, i) => v * top[3] + under[i] * (1 - top[3]));
  const luminance = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const paper = rgba(getComputedStyle(document.body).backgroundColor);
  const found = new Map();
  let measured = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, element = node.parentElement;
    if (!node.data.trim() || !element || ["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(element.tagName)) continue;
    if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    if (box.width < 3 || box.height < 3) continue;
    const style = getComputedStyle(element);
    if (style.webkitTextFillColor === "rgba(0, 0, 0, 0)") continue;
    const layers = [];
    let plain = true, fade = 1, inactive = false;
    for (let at = element; at; at = at.parentElement) {
      const here = getComputedStyle(at);
      fade *= Number(here.opacity);
      if (at.matches(":disabled, [aria-disabled=true]")) inactive = true;
      if (here.backgroundImage !== "none") { plain = false; break; }
      const color = rgba(here.backgroundColor);
      if (color[3] > 0) layers.push(color);
      if (color[3] >= .99) break;
    }
    if (!plain || fade < .99 || inactive) continue;
    let background = paper[3] ? paper.slice(0, 3) : [255, 255, 255];
    for (const layer of layers.reverse()) background = over(layer, background);
    const color = over(rgba(style.color), background);
    const [a, b] = [luminance(color), luminance(background)].sort((x, y) => y - x);
    const ratio = (a + .05) / (b + .05);
    const size = parseFloat(style.fontSize), large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    measured++;
    if (ratio >= (large ? 3 : 4.5)) continue;
    const name = `${element.tagName.toLowerCase()}.${String(element.className?.baseVal ?? element.className).split(" ").slice(0, 2).join(".")} in .${String(element.parentElement?.className ?? "").split(" ")[0]}`;
    if (!found.has(name)) found.set(name, `${ratio.toFixed(2)} ${name} "${node.data.trim().slice(0, 30)}" rgb(${color.map(Math.round)}) on rgb(${background.map(Math.round)})`);
  }
  return { measured, problems: [...found.values()] };
}

export async function verifyThemeLive(context, anonymous) {
  const folder = process.env.THEME_SCREENSHOTS;
  if (folder) await mkdir(folder, { recursive: true });
  const only = process.env.THEME_PAGES?.split(",");
  const summary = [];
  const errors = [];
  for (const [owner, pages] of [[anonymous, publicPages], [context, privatePages]]) {
    const page = await owner.newPage();
    page.on("pageerror", error => errors.push(`${page.url()} ${String(error).slice(0, 300)}`));
    page.on("console", message => { if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(`${page.url()} ${message.text().slice(0, 300)}`); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const path of pages) {
      if (only && !only.includes(path)) continue;
      const counts = {};
      for (const theme of ["dark", "light"]) {
        await page.goto("/robots.txt");
        await page.evaluate(value => localStorage.setItem("careerforge-theme", value), theme);
        await page.goto(path, { waitUntil: "networkidle" }).catch(() => page.waitForLoadState("load"));
        await page.waitForTimeout(700);
        if (process.env.THEME_FULL) await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(done => setTimeout(done, 60)); } scrollTo(0, 0); });
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), theme, `${path} uses the ${theme} theme`);
        const result = await page.evaluate(audit);
        counts[theme] = result.problems.length;
        if (theme === "light") for (const problem of result.problems) console.log(`  ${path}: ${problem}`);
        if (folder) await page.screenshot({ path: `${folder}/${theme}${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-$/, "-home")}.png`, fullPage: Boolean(process.env.THEME_FULL) });
      }
      summary.push(`${path} ${counts.dark}/${counts.light}`);
    }
    await page.close();
  }
  // Things that open: the same check on their text, at desktop and phone widths.
  const states = [
    ["palette", 1440, "/dashboard", page => page.getByRole("button", { name: "Search pages and actions" }).click()],
    ["drawer", 390, "/dashboard", page => page.getByRole("button", { name: "Open navigation", exact: true }).click()],
    ["filters", 1440, "/workshops", page => page.getByRole("button", { name: "Filters", exact: true }).click()],
    ["submit", 390, "/workshops", page => page.getByRole("button", { name: "Submit workshop" }).click()],
    ["phone-workshops", 390, "/workshops", async () => {}],
    ["phone-roadmap", 390, "/learning-roadmap/docker", async () => {}],
    ["phone-profile", 390, "/account", async () => {}],
    ["topic", 1440, "/learning-roadmap/docker", page => page.getByRole("button", { name: /Why containers/ }).first().click()],
    ["phone-home", 390, "/", async () => {}]
  ];
  const opened = await context.newPage();
  await opened.emulateMedia({ reducedMotion: "reduce" });
  for (const [name, width, path, act] of only ? [] : states) {
    await opened.setViewportSize({ width, height: 900 });
    await opened.goto(path, { waitUntil: "networkidle" }).catch(() => {});
    await opened.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await opened.reload({ waitUntil: "networkidle" }).catch(() => {});
    await act(opened);
    await opened.waitForTimeout(500);
    const result = await opened.evaluate(audit);
    for (const problem of result.problems) console.log(`  ${name}: ${problem}`);
    assert.equal(await opened.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name} overflows`);
    if (folder) await opened.screenshot({ path: `${folder}/light-state-${name}.png` });
  }
  await opened.close();
  console.log(`Low-contrast text, dark/light: ${summary.join(", ")}`);

  // The extra button fits in every header, right after resizing and once settled.
  for (const [owner, paths] of [[context, ["/account", "/application-agent", "/workshops", "/cv"]], [anonymous, ["/", "/login", "/register", "/forgot-password"]]]) {
    const fit = await owner.newPage();
    for (const path of paths) {
      await fit.setViewportSize({ width: 1440, height: 900 });
      await fit.goto(path, { waitUntil: "load" });
      await expect(fit.locator(".theme-toggle").first()).toBeVisible({ timeout: 20_000 });
      for (const width of [1440, 1250, 1024, 980, 860, 768, 640, 480, 420, 390, 360, 320]) {
        await fit.setViewportSize({ width, height: 900 });
        for (const wait of [0, 450]) {
          await fit.waitForTimeout(wait);
          const problem = await fit.evaluate(() => {
            const wide = document.documentElement.scrollWidth - innerWidth;
            if (wide > 0) return `page overflows by ${wide}px`;
            const button = [...document.querySelectorAll(".theme-toggle")].find(item => item.checkVisibility());
            if (!button) return "no theme button";
            const box = button.getBoundingClientRect();
            if (box.width < 38 || box.left < 0 || box.right > innerWidth) return `theme button at ${Math.round(box.left)}-${Math.round(box.right)}`;
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return button.contains(hit) ? null : `theme button covered by ${hit?.className}`;
          });
          assert.equal(problem, null, `${path} at ${width}px after ${wait}ms: ${problem}`);
        }
      }
    }
    await fit.close();
  }

  // The button switches, is remembered, and other tabs follow.
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.evaluate(() => localStorage.removeItem("careerforge-theme"));
  await page.reload();
  const scheme = target => target.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  assert.equal(await scheme(page), "dark", "dark is the default");
  await page.getByRole("button", { name: "Use the light theme" }).click();
  assert.equal(await scheme(page), "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f4f7f0");
  const second = await context.newPage();
  await second.goto("/features");
  assert.equal(await scheme(second), "light", "remembered");
  await second.getByRole("button", { name: "Use the dark theme" }).click();
  await expect.poll(() => scheme(page)).toBe("dark");
  await second.close();
  await page.close();
  assert.deepEqual(errors, []);
  console.log("PASS: light and dark themes on every page, switch, remembered choice, other tabs.");
}
