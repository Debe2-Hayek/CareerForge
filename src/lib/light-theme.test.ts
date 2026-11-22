import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import postcss from "postcss";

const lightTheme = createRequire(import.meta.url)("../../postcss/light-theme.cjs");
const lightOf: (hex: string, kind?: "colour" | "shadow") => string = lightTheme.lightOf;
const build = async (css: string) => (await postcss([lightTheme()]).process(css, { from: undefined })).css;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };

test("text that is readable in the dark theme stays readable in the light one", () => {
  const surfaces = ["#111411", "#161c14", "#191d19", "#1c2419", "#20251f"];
  for (const text of ["#f2f6ec", "#b9c6ae", "#a0aa98", "#93a188", "#c5ed85", "#8fd6ff", "#cdb6ff", "#9cc3ff", "#ffa5a0", "#ffd166", "#7fe3c4"]) {
    for (const surface of surfaces) {
      assert.ok(contrast(lightOf(text), lightOf(surface)) >= 4.5, `${text} on ${surface}: ${contrast(lightOf(text), lightOf(surface)).toFixed(2)}`);
    }
  }
  // Dark text on a bright button becomes light text on a deep one.
  for (const button of ["#c5ed85", "#8fd6ff", "#cdb6ff"]) assert.ok(contrast(lightOf("#12190c"), lightOf(button)) >= 4.5, button);
  // Surfaces get lighter, borders stay visible, transparency is kept.
  assert.ok(luminance(lightOf("#111411")) > 0.8 && luminance(lightOf("#161c14")) > luminance(lightOf("#111411")));
  assert.ok(contrast(lightOf("#2c3728"), lightOf("#161c14")) > 1.15);
  assert.equal(lightOf("#ffffff0d").length, 9);
  assert.equal(lightOf("#0000"), "#0000");
});

test("the build adds a light colour beside every dark one and leaves the rest alone", async () => {
  assert.match(await build(".a { color: #f2f6ec; }"), /color: light-dark\(#[0-9a-f]{6}, #f2f6ec\)/);
  assert.match(await build(".a { background: linear-gradient(#111, #c5ed8533); }"), /linear-gradient\(light-dark\(#[0-9a-f]{6}, #111\), light-dark\(#[0-9a-f]{8}, #c5ed8533\)\)/);
  for (const same of [
    ".a { color: light-dark(#fff, #000); }",
    ':root[data-theme="light"] .ambient { background: #ffffff; }',
    ':global(:root[data-theme="light"]) .ringItem { --green: #ffffff; }',
    ".cv-sheet { background: #fff; color: #172017; }",
    ".portfolio-story h3 { color: #203122; }",
    ".published-site { background: #0c0e17; }",
    "@media print { .a { color: #111; } }",
    "dialog::backdrop { background: #070a06b3; }",
    ".a { mask-image: linear-gradient(#000, transparent); }",
    ".a { background: url(\"data:image/svg+xml,%3Csvg fill='#c5ed85'/%3E\"); }",
    "a[href='#abc'] { margin: 0; }"
  ]) assert.equal(await build(same), same);
  // Controls around the portfolio are part of the app, not of the paper.
  assert.match(await build(".portfolio-editor-layout p { color: #a0aa98; }"), /light-dark/);
  // A hand-picked colour does not stop the others in the same value from getting theirs.
  assert.match(await build(".a { background: linear-gradient(#171e15, light-dark(#000, #c5ed85)); }"), /linear-gradient\(light-dark\(#[0-9a-f]{6}, #171e15\), light-dark\(#000, #c5ed85\)\)/);
  // Neutrals and the brand green lose their colour; topics, levels and warnings keep it.
  const grey = (hex: string) => hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);
  for (const plain of ["#111411", "#161c14", "#43543a", "#b9c6ae", "#c5ed85"]) assert.ok(grey(lightOf(plain)), plain);
  for (const meaning of ["#8be58f", "#8fd6ff", "#cdb6ff", "#ffa5a0", "#ffd166"]) assert.ok(!grey(lightOf(meaning)), meaning);
  // A shadow stays dark and becomes softer.
  const shadow = /light-dark\((#[0-9a-f]{8}), #000c\)/.exec(await build(".a { box-shadow: 0 2px 9px #000c; }"));
  assert.ok(shadow && luminance(shadow[1]) < 0.05 && parseInt(shadow[1].slice(7), 16) < 0x50);
});
