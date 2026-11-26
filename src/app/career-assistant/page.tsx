import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CareerAssistant } from "@/components/career-assistant";
import { assistantProvider } from "@/lib/assistant/server";
import { serviceLabel } from "@/lib/assistant/handlers";
import { signedInClient } from "@/lib/cv-analysis/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI assistant - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  const session = await signedInClient().catch(() => null);
  if (!session) redirect("/login");
  const info = assistantProvider();
  // Only the first name, for the greeting; nothing else from the profile is read here.
  const { data } = await session.client.from("profiles").select("full_name").eq("id", session.userId).maybeSingle();
  const firstName = String(data?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
  return <AppShell pageTitle="AI assistant" privateAccount displayName={String(data?.full_name ?? "") || undefined}>
    <div className="account-content chat-page">
      <CareerAssistant service={info ? serviceLabel[info.service] : null} firstName={firstName} userId={session.userId} />
    </div>
  </AppShell>;
}
