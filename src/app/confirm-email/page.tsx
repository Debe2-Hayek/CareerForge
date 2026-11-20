import { AccountRecovery } from "@/components/account-recovery";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = { ...privatePageMetadata, title: "Confirm email | CareerForge" };
export default function ConfirmEmailPage() { return <AccountRecovery mode="resend" />; }
