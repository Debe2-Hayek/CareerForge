import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CareerAssistant } from "@/components/career-assistant";
import { assistantProvider } from "@/lib/assistant/server";
import { serviceLabel } from "@/lib/assistant/handlers";
import { chatStore, type ChatDetail, type ChatSummary } from "@/lib/assistant/chats";
import { signedInClient } from "@/lib/cv-analysis/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI assistant - CareerForge", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  const session = await signedInClient().catch(() => null);
  if (!session) redirect("/login");
  const info = assistantProvider();
  const wanted = (await searchParams).chat;
  const store = chatStore(session.client);
  // Only the first name, for the greeting; the saved chats are the person's own (row-level security).
  const [{ data }, chats] = await Promise.all([
    session.client.from("profiles").select("full_name").eq("id", session.userId).maybeSingle(),
    store.list().then(list => list as ChatSummary[] | null).catch(() => null)
  ]);
  // A ?chat= link opens that chat; otherwise a fresh chat, like ChatGPT and Claude.
  let opened: ChatDetail | null = null;
  if (chats && typeof wanted === "string" && chats.some(chat => chat.id === wanted)) opened = await store.get(wanted).catch(() => null);
  const firstName = String(data?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
  return <AppShell pageTitle="AI assistant" privateAccount displayName={String(data?.full_name ?? "") || undefined}>
    <div className="account-content chat-page">
      <CareerAssistant service={info ? serviceLabel[info.service] : null} firstName={firstName} initialChats={chats ?? []} initialChat={opened} historyAvailable={chats !== null} />
    </div>
  </AppShell>;
}
