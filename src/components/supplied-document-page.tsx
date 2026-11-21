import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authorizeProfile } from "@/lib/account/server";
import { readOwnPortfolioSite } from "@/lib/portfolio-site-server";
import { siteOrigin } from "@/lib/site-url";
import { AppShell } from "./app-shell";
import { SuppliedDocumentBuilder } from "./supplied-document-builder";

/** Origin used to show the public site address: the configured origin in production, this host in development. */
async function publicOrigin() {
  if (process.env.NODE_ENV === "production") return process.env.APP_ORIGIN || siteOrigin;
  const host = (await headers()).get("host");
  return host && /^[a-z0-9.:-]+$/i.test(host) ? `http://${host}` : siteOrigin;
}

export async function SuppliedDocumentPage() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  try { access = await authorizeProfile(); }
  catch {
    return <AppShell pageTitle="CV & Portfolio" privateAccount>
      <div className="empty-state"><h1>The builder is temporarily unavailable.</h1><p>We could not confirm your session. Try again.</p><Link href="/documents" className="button primary">Try again</Link></div>
    </AppShell>;
  }
  if (!access) redirect("/login");
  // A failed read keeps the builder usable as a local sandbox; saving is then disabled.
  const [site, origin] = await Promise.all([readOwnPortfolioSite(), publicOrigin()]);
  return <AppShell pageTitle="CV & Portfolio" privateAccount contentClassName="document-workspace">
    <SuppliedDocumentBuilder initial={site} origin={origin} />
  </AppShell>;
}
