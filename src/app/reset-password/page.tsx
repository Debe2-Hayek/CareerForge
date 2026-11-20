import { AccountRecovery } from "@/components/account-recovery";
import { createClient } from "@/lib/supabase/server";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = { ...privatePageMetadata, title: "Choose a new password | CareerForge" };

export default async function ResetPasswordPage() {
  let sessionReady = false;
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    sessionReady = !error && !!user;
  } catch { /* Offer a fresh recovery link instead of an unusable form. */ }
  return <AccountRecovery mode="reset" sessionReady={sessionReady} />;
}
