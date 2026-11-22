// The chosen theme. Dark is the default; the choice is kept on this device and
// applied as data-theme on <html>, which visual-system.css turns into color-scheme.

export type Theme = "dark" | "light";
const key = "careerforge-theme";
const changed = "careerforge-theme";
export const themeColor: Record<Theme, string> = { dark: "#111411", light: "#ffffff" };

/** Runs before the first paint, so a light page never flashes dark. Keep in step with `apply`. */
export const themeScript = `try{if(localStorage.getItem("${key}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export const readTheme = (): Theme => document.documentElement.dataset.theme === "light" ? "light" : "dark";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.dataset.theme = "light"; else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor[theme]);
}

export function setTheme(theme: Theme) {
  apply(theme);
  try { localStorage.setItem(key, theme); } catch { /* not remembered, still applied to this page */ }
  window.dispatchEvent(new Event(changed));
}
export const toggleTheme = () => setTheme(readTheme() === "light" ? "dark" : "light");

export function subscribeTheme(callback: () => void) {
  // Another tab changed it.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return;
    apply(event.newValue === "light" ? "light" : "dark");
    callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(changed, callback); };
}
