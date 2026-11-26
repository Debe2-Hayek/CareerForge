import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { bankSchema, readCheckStandings, sessionReplySchema } from "@/lib/skill-checks";
import { learnHrefFor } from "@/lib/skill-check-links";
import { SkillChecks, type CheckCard } from "@/components/skill-checks";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Skill checks — CareerForge", robots: { index: false, follow: false } };
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SkillChecksPage({ searchParams }: Props) {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  const wanted = (await searchParams).skill;
  let account;
  let anonymous = false;
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) anonymous = true;
    else {
      const [catalog, standings, profile, current] = await Promise.all([client.rpc("skill_check_catalog"), readCheckStandings(client, user.id), client.from("profiles").select("full_name,self_reported_skills").eq("id", user.id).single(), client.rpc("current_skill_check_session")]);
      if (catalog.error || profile.error || current.error) throw new Error("Checks unavailable");
      const selected = ((profile.data.self_reported_skills as string[] | null) ?? []).map(skill => skill.trim().toLowerCase());
      const cards: CheckCard[] = bankSchema.parse(catalog.data).map(bank => {
        const standing = standings.get(bank.skill.toLowerCase());
        return { skill: bank.skill, onProfile: selected.includes(bank.skill.toLowerCase()), passedAt: standing?.passedAt ?? null, lastScore: standing?.lastScore ?? null, retryAt: standing?.retryAt ?? null, learnHref: learnHrefFor(bank.skill) };
      });
      account = { name: profile.data.full_name as string, cards, session: sessionReplySchema.parse(current.data).session };
    }
  } catch { /* Show a retry state, never a fabricated pass. */ }
  if (anonymous) redirect("/login");
  if (!account) return <main className="account-content"><div className="empty-state"><h1>Skill checks are temporarily unavailable.</h1><p>Your existing results have not changed.</p><Link href="/skill-checks" className="button primary">Try again</Link></div></main>;
  return <AppShell pageTitle="Skill checks" privateAccount displayName={account.name}>
    <SkillChecks cards={account.cards} initialSession={account.session?.state === "active" ? account.session : null} focus={typeof wanted === "string" ? wanted.slice(0, 60) : null} />
  </AppShell>;
}
