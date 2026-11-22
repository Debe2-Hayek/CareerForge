import lightTheme from "./postcss/light-theme.cjs";

const config = {
  plugins: [
    // Adds the light theme; see the notes at the top of that file.
    lightTheme(),
    "@tailwindcss/postcss"
  ]
};

export default config;
