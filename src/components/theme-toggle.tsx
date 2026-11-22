"use client";

import { useEffect, useSyncExternalStore } from "react";
import { readTheme, subscribeTheme, themeColor, toggleTheme, type Theme } from "@/lib/theme";

/** Switches between the dark and the light theme. The icon shows the theme you would get. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => "dark");
  // The browser's own toolbar follows too, including after a light page first loads.
  useEffect(() => { document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor[theme]); }, [theme]);
  const label = theme === "light" ? "Use the dark theme" : "Use the light theme";
  return <button type="button" className={`theme-toggle ${className}`} aria-label={label} title={label} onClick={toggleTheme}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {theme === "light"
        ? <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z" />
        : <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" /></>}
    </svg>
  </button>;
}
