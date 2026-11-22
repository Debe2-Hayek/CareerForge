// Derives the light theme from the dark one at build time.
//
// The stylesheets are written for the dark theme. Every hex colour in them becomes
// light-dark(<derived light colour>, <the original>), so the dark theme stays exactly
// as written and new styles get a light version without extra work. Which one applies
// follows `color-scheme` (see :root in visual-system.css).
//
// To choose a light colour by hand, write light-dark(#light, #dark) in the stylesheet:
// values that already use it are left alone. Things that look the same in both themes
// (paper, published portfolios, print) are listed in `keep`.

const keep = /\.cv-sheet|\.portfolio-(sheet|identity|headline|location|story|skills|source-note|empty-note|editorial\b(?!-layout))|\.viz-paper|\.lp-float-cv|\.published-site|\.pb \.cv|\.cv-page|\.hero-film|\.next-step|\.step-check|dateTile|::selection/;

const srgbToLinear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linearToSrgb = c => c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

function toOklch([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(v => srgbToLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function fromOklch(L, C, h) {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}

/** Lowers the chroma until the colour can be shown on a screen. */
function inGamut(L, C, h) {
  for (let chroma = C; ; chroma -= 0.004) {
    const rgb = fromOklch(L, Math.max(0, chroma), h);
    if (chroma <= 0 || rgb.every(v => v >= -0.0005 && v <= 1.0005)) return rgb.map(v => Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.min(1, Math.max(0, v))))) * 255));
  }
}

function parse(hex) {
  let digits = hex.slice(1);
  if (digits.length < 6) digits = [...digits].map(d => d + d).join("");
  return { rgb: [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16)), alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1 };
}
const two = value => Math.round(value).toString(16).padStart(2, "0");
const write = (rgb, alpha) => `#${rgb.map(two).join("")}${alpha < 1 ? two(alpha * 255) : ""}`;

// Dark lightness -> light lightness. Surfaces become near-white, hairlines a soft grey,
// text dark; the middle keeps enough distance from white to stay readable as text.
const curve = [[0, 0.95], [0.16, 0.955], [0.195, 0.966], [0.212, 0.99], [0.236, 0.988], [0.26, 0.958], [0.3, 0.925], [0.345, 0.89], [0.4, 0.835], [0.48, 0.75], [0.56, 0.6], [0.64, 0.51], [0.72, 0.46], [0.8, 0.4], [0.9, 0.3], [1, 0.2]];
function mapLightness(L) {
  for (let i = 1; i < curve.length; i++) {
    if (L > curve[i][0]) continue;
    const [x0, y0] = curve[i - 1], [x1, y1] = curve[i];
    return y0 + (y1 - y0) * ((L - x0) / (x1 - x0));
  }
  return curve[curve.length - 1][1];
}

/** The light counterpart of one dark-theme colour. */
function lightOf(hex, kind = "colour") {
  const { rgb, alpha } = parse(hex);
  if (alpha === 0) return hex;
  const [L, C, h] = toOklch(rgb);
  if (kind === "shadow") {
    // A shadow is still dark, only much softer; a coloured glow keeps its hue.
    return L < 0.45 ? write([26, 36, 20], alpha * 0.26) : write(inGamut(0.62, Math.min(C, 0.13), h), alpha * 0.5);
  }
  let lightness = mapLightness(L), chroma = C;
  if (L < 0.34) chroma = Math.min(C * 0.55, 0.035);
  else if (C > 0.045 && L > 0.6) { lightness = Math.max(0.445, Math.min(0.485, lightness + 0.1)); chroma = C * 1.2; }
  else if (C <= 0.045) chroma = C * 0.8;
  return write(inGamut(lightness, chroma, h), alpha);
}

const colours = /url\((?:"[^"]*"|'[^']*'|[^)]*)\)|#[0-9a-f]{8}\b|#[0-9a-f]{6}\b|#[0-9a-f]{3,4}\b/gi;
const isShadow = declaration => /shadow/.test(declaration.prop) || (declaration.prop === "filter" && declaration.value.includes("drop-shadow"));

function keeps(node) {
  for (let at = node; at; at = at.parent) {
    if (at.type === "rule" && keep.test(at.selector)) return true;
    if (at.type === "atrule" && at.name === "media" && /\bprint\b/.test(at.params)) return true;
  }
  return false;
}

const plugin = () => ({
  postcssPlugin: "careerforge-light-theme",
  Declaration(declaration) {
    if (!declaration.value.includes("#") || declaration.value.includes("light-dark(") || /^(-webkit-)?mask/.test(declaration.prop)) return;
    if (/node_modules/.test(declaration.source?.input?.file ?? "") || keeps(declaration.parent)) return;
    // A modal's backdrop dims the page in both themes.
    if (declaration.parent.type === "rule" && /::backdrop/.test(declaration.parent.selector)) return;
    const kind = isShadow(declaration) ? "shadow" : "colour";
    const value = declaration.value.replace(colours, match => {
      if (!match.startsWith("#")) return match;
      const light = lightOf(match, kind);
      return light.toLowerCase() === match.toLowerCase() ? match : `light-dark(${light}, ${match})`;
    });
    if (value !== declaration.value) declaration.value = value;
  }
});
plugin.postcss = true;

module.exports = plugin;
module.exports.lightOf = lightOf;
