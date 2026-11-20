import type { ReactNode } from "react";
import { AuthFrame } from "@/components/auth-frame";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
