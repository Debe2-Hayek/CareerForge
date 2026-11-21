import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./visual-system.css";
import "./feature-system.css";
import "./supplied-builder.css";
import "./profile-history.css";
import "./experience.css";
import "./profile-start.css";
import { AmbientBackground } from "@/components/ambient-background";
import { SelfDiagnoseProvider } from "@/components/self-diagnose-provider";
import { siteOrigin } from "@/lib/site-url";

const title = "CareerForge — Build a career you can stand behind";
const description = "Build a private, evidence-first career profile, complete supported skill checks, create your CV and track your next opportunities with CareerForge.";
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title,
  description,
  applicationName: "CareerForge",
  openGraph: { title, description, type: "website", siteName: "CareerForge", url: siteOrigin, locale: "en_US" },
  twitter: { card: "summary", title, description },
  verification: googleVerification && googleVerification !== "[GOOGLE_VERIFICATION_CODE]"
    ? { google: googleVerification }
    : undefined
};

export const viewport: Viewport = { themeColor: "#111411", colorScheme: "dark" };

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Extensions can add document-wrapper attributes; app descendants keep hydration checks.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="site-layer">{children}</div>
        <SelfDiagnoseProvider />
        {/* After the page in the DOM so the skip link stays first in the tab order; it is fixed-position, so it still paints behind the page. */}
        <AmbientBackground />
      </body>
    </html>
  );
}
