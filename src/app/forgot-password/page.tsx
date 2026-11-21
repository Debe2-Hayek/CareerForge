import { AccountRecovery } from "@/components/account-recovery";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = { ...privatePageMetadata, title: "Reset password | CareerForge" };
export default function ForgotPasswordPage() { return <AccountRecovery mode="forgot" />; }
