# Light and dark themes

Dark is the default. The sun/moon button (header, landing page, sign-in pages, command
palette) switches; the choice is kept on the device (`careerforge-theme`) and other open
tabs follow.

- The stylesheets are written once, for the dark theme. At build time
  `postcss/light-theme.cjs` turns every hex color into `light-dark(light, dark)`: lightness
  is turned over in OKLCH, hue kept, contrast kept. The dark color is never changed.
- To choose a light color by hand, write `light-dark(#light, #dark)`; it is left alone.
- What looks the same in both themes is listed in `keep` in that file: CV and portfolio
  paper, published portfolios, print, the film. A dark block on a light page sets
  `color-scheme: dark` and its color tokens (see `.launchpad.has-film`, `.ringItem`).
- `color-scheme` on `:root` picks the theme (`data-theme="light"`). A short inline script
  sets it before the first paint, so there is no flash. Older browsers get an equivalent
  the bundler generates.
- The background canvas keeps its drawing; a CSS filter turns its light strokes into ink.

**Checks**: `src/lib/light-theme.test.ts`, and on development
`test-account-live.mjs --theme-only`, which opens every page in both themes, measures text
contrast, and checks the switch, menus and phone widths. Measured text: plain backgrounds
only; text on photos and gradients was looked at by eye.
