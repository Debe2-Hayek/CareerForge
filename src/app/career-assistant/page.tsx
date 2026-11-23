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
  return <AppShell pageTitle="AI assistant" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">CAREER ASSISTANT</p><h1>Ask your career assistant<span>.</span></h1><p>Practical answers that use only the parts of your profile you choose to share. It never invents facts about you.</p></div></div>
      <CareerAssistant service={info ? serviceLabel[info.service] : null} />
    </div>
  </AppShell>;
}
