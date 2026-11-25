import { Bricolage_Grotesque, Inter } from "next/font/google";

// The CV & portfolio builder's two typefaces, self-hosted by Next.js (downloaded at build time).
// Before, the builder fetched them from Google Fonts when it appeared: the big name painted twice
// (fallback, then the real face) and every visitor's address went to Google. Now they are served
// from CareerForge, preloaded, and sized to avoid layout shift.
const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-bricolage", display: "swap" });
const text = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/** Put on the element that wraps the builder or a published portfolio. */
export const builderFonts = `${display.variable} ${text.variable}`;
